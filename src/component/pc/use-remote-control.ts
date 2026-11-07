import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import {
  applyServerControlMessage,
  CONTROL_OFF_STATE,
  endControl,
  startControl,
  timeOutControlRequest,
  type RemoteControlEndReason,
  type RemoteControlState,
} from '../../lib/remote-control'
import {
  buildButtonMessage,
  buildControlMessage,
  buildKeyMessage,
  buildMoveMessage,
  buildWheelMessage,
  createFrameCoalescer,
  getPressedButtons,
  isReleaseShortcut,
  keepLatest,
  mapPointerToFrame,
  mergeWheelUnits,
  RELEASE_MESSAGE,
  toWheelUnits,
  type FramePoint,
  type RemoteMouseButton,
  type WheelUnits,
} from '../../lib/remote-input'
import type { ScreenStreamStatus } from '../../lib/screen-stream'
import type { ScreenSocketEvent, ScreenStream } from './use-screen-stream'

// The server gives up after 5 s. The admin waits a little longer, then stops on its own side too.
const CONTROL_REQUEST_TIMEOUT_MS = 8000

interface UseRemoteControlOptions {
  screen: Pick<ScreenStream, 'canvasRef' | 'status' | 'sendMessage' | 'subscribe'>
  onReleaseShortcut: () => void
}

export interface RemoteControl {
  state: RemoteControlState
  start: () => void
  stop: () => void
}

// A paused screen (for example a UAC prompt) has its own message. Any other non-live status is a connection problem.
function getScreenEndReason(kind: ScreenStreamStatus['kind']): RemoteControlEndReason {
  return kind === 'paused' ? 'paused' : 'connection'
}

// Drives Take control. Input listeners exist only while control is on, and every input message
// is sent on the screen socket. The server relays input only after the PC confirms control.
export function useRemoteControl({ screen, onReleaseShortcut }: UseRemoteControlOptions): RemoteControl {
  const { canvasRef, status, sendMessage, subscribe } = screen
  const [state, setState] = useState<RemoteControlState>(CONTROL_OFF_STATE)
  const [trackedStatusKind, setTrackedStatusKind] = useState(status.kind)
  const isOn = state.kind === 'on'
  const isRequesting = state.kind === 'requesting'
  const isActiveRef = useRef(false)
  const reportReleaseShortcut = useEffectEvent(onReleaseShortcut)

  // A picture that stops being live ends control on this side. The socket may still be open
  // (paused), so the server is told to stop in handleSocketEvent.
  if (status.kind !== trackedStatusKind) {
    setTrackedStatusKind(status.kind)
    if (status.kind !== 'live') {
      setState((previous) => endControl(previous, getScreenEndReason(status.kind)))
    }
  }

  const handleSocketEvent = useEffectEvent((event: ScreenSocketEvent) => {
    if (event.kind === 'control') {
      setState((previous) => applyServerControlMessage(previous, event.message))
      return
    }
    if (event.kind === 'closed') {
      setState((previous) => endControl(previous, 'connection'))
      return
    }
    if (event.state === 'live' || state.kind === 'off') return
    sendMessage(RELEASE_MESSAGE)
    sendMessage(buildControlMessage(false))
    setState((previous) => endControl(previous, getScreenEndReason(event.state)))
  })

  useEffect(() => subscribe((event) => handleSocketEvent(event)), [subscribe])

  useEffect(() => {
    if (!isRequesting) return
    const timeout = window.setTimeout(() => {
      sendMessage(buildControlMessage(false))
      setState((previous) => timeOutControlRequest(previous))
    }, CONTROL_REQUEST_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [isRequesting, sendMessage])

  useLayoutEffect(() => {
    isActiveRef.current = state.kind !== 'off'
  })

  // Layout cleanups run before the stream's socket cleanup on unmount, so the PC is still reachable here.
  useLayoutEffect(
    () => () => {
      if (!isActiveRef.current) return
      sendMessage(RELEASE_MESSAGE)
      sendMessage(buildControlMessage(false))
    },
    [sendMessage],
  )

  useEffect(() => {
    const currentCanvas = canvasRef.current
    if (!isOn || !currentCanvas) return
    const canvas: HTMLCanvasElement = currentCanvas

    const controller = new AbortController()
    const { signal } = controller
    const heldButtons = new Set<RemoteMouseButton>()
    // The KeyX key-down of the release shortcut was swallowed, so its key-up must not reach the PC.
    let isReleaseKeyHeld = false

    const moves = createFrameCoalescer<FramePoint>({
      merge: keepLatest,
      send: (point) => sendMessage(buildMoveMessage(point)),
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
    })
    const wheel = createFrameCoalescer<WheelUnits>({
      merge: mergeWheelUnits,
      send: (units) => {
        const message = buildWheelMessage(units)
        if (message) sendMessage(message)
      },
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
    })

    function flushPendingInput() {
      moves.flush()
      wheel.flush()
    }

    // Releases everything the PC holds. Keys and buttons are never dropped by a rate cap, so this always sends.
    function sendRelease() {
      moves.cancel()
      wheel.cancel()
      heldButtons.clear()
      sendMessage(RELEASE_MESSAGE)
    }

    function framePointOf(event: PointerEvent, clamp = false): FramePoint | null {
      return mapPointerToFrame(
        event,
        canvas.getBoundingClientRect(),
        { width: canvas.width, height: canvas.height },
        { clamp },
      )
    }

    // Sends a down for each button that is newly pressed and an up for each held button that is
    // released. A button only gets an up if its down was sent, so a down dropped outside the image
    // leaves no unmatched up behind.
    function syncButtons(event: PointerEvent) {
      const pressed = getPressedButtons(event.buttons)
      const pressPoint = framePointOf(event)
      const releasePoint = framePointOf(event, true)
      for (const button of [...heldButtons]) {
        if (pressed.includes(button) || releasePoint === null) continue
        flushPendingInput()
        heldButtons.delete(button)
        sendMessage(buildButtonMessage('up', button, releasePoint))
      }
      for (const button of pressed) {
        if (heldButtons.has(button) || pressPoint === null) continue
        flushPendingInput()
        heldButtons.add(button)
        sendMessage(buildButtonMessage('down', button, pressPoint))
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const point = framePointOf(event)
      if (point) moves.push(point)
      syncButtons(event)
    }

    function handlePointerDown(event: PointerEvent) {
      // Browser mousedown focus is suppressed, so the screen takes focus here for keys.
      canvas.focus()
      canvas.setPointerCapture(event.pointerId)
      syncButtons(event)
    }

    function handlePointerUp(event: PointerEvent) {
      syncButtons(event)
    }

    function handlePointerCancel() {
      sendRelease()
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      wheel.push(toWheelUnits(event))
    }

    function handleKeyDown(event: KeyboardEvent) {
      event.preventDefault()
      if (isReleaseShortcut(event)) {
        // The Ctrl, Alt and Shift key-downs were already sent to the PC. This release lets go of
        // them with everything else the PC holds.
        isReleaseKeyHeld = true
        sendRelease()
        reportReleaseShortcut()
        return
      }
      if (event.code === 'KeyX') isReleaseKeyHeld = false
      const message = buildKeyMessage(event.code, true)
      if (message) sendMessage(message)
    }

    function handleKeyUp(event: KeyboardEvent) {
      event.preventDefault()
      if (event.code === 'KeyX' && isReleaseKeyHeld) {
        isReleaseKeyHeld = false
        return
      }
      const message = buildKeyMessage(event.code, false)
      if (message) sendMessage(message)
    }

    function preventDefault(event: Event) {
      event.preventDefault()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') sendRelease()
    }

    canvas.addEventListener('pointermove', handlePointerMove, { signal })
    canvas.addEventListener('pointerdown', handlePointerDown, { signal })
    canvas.addEventListener('pointerup', handlePointerUp, { signal })
    canvas.addEventListener('pointercancel', handlePointerCancel, { signal })
    canvas.addEventListener('contextmenu', preventDefault, { signal })
    // Browser mouse defaults would navigate back or forward, or start middle-click autoscroll.
    canvas.addEventListener('mousedown', preventDefault, { signal })
    canvas.addEventListener('mouseup', preventDefault, { signal })
    canvas.addEventListener('auxclick', preventDefault, { signal })
    // Non-passive so preventDefault stops the page from scrolling while the wheel controls the PC.
    canvas.addEventListener('wheel', handleWheel, { passive: false, signal })
    canvas.addEventListener('keydown', handleKeyDown, { signal })
    canvas.addEventListener('keyup', handleKeyUp, { signal })
    canvas.addEventListener('blur', sendRelease, { signal })
    document.addEventListener('visibilitychange', handleVisibilityChange, { signal })

    return () => {
      controller.abort()
      moves.cancel()
      wheel.cancel()
    }
  }, [isOn, canvasRef, sendMessage])

  function start() {
    if (state.kind !== 'off' || status.kind !== 'live') return
    if (!sendMessage(buildControlMessage(true))) {
      setState({ kind: 'off', reason: 'connection' })
      return
    }
    setState(startControl(state))
  }

  // The state changes at once, so the UI never waits for the PC's reply.
  function stop() {
    if (state.kind === 'off') return
    if (state.kind === 'on') sendMessage(RELEASE_MESSAGE)
    sendMessage(buildControlMessage(false))
    setState(endControl(state, 'stopped'))
  }

  return { state, start, stop }
}
