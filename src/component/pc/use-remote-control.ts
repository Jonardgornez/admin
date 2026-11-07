import { useEffect, useEffectEvent, useState } from 'react'
import {
  applyServerControlMessage,
  CONTROL_OFF_STATE,
  endControl,
  startControl,
  type RemoteControlState,
} from '../../lib/remote-control'
import {
  buildButtonMessage,
  buildControlMessage,
  buildKeyMessage,
  buildMoveMessage,
  buildWheelMessage,
  createMoveCoalescer,
  isReleaseShortcut,
  mapPointerToFrame,
  RELEASE_MESSAGE,
  toRemoteButton,
  type FramePoint,
} from '../../lib/remote-input'
import type { ScreenSocketEvent, ScreenStream } from './use-screen-stream'

interface UseRemoteControlOptions {
  screen: Pick<ScreenStream, 'canvasRef' | 'status' | 'sendMessage' | 'subscribe'>
  onReleaseShortcut: () => void
}

export interface RemoteControl {
  state: RemoteControlState
  start: () => void
  stop: () => void
}

// Drives Take control. Input listeners exist only while control is on, and every input message
// is sent on the screen socket. The server relays input only after the PC confirms control.
export function useRemoteControl({ screen, onReleaseShortcut }: UseRemoteControlOptions): RemoteControl {
  const { canvasRef, status, sendMessage, subscribe } = screen
  const [state, setState] = useState<RemoteControlState>(CONTROL_OFF_STATE)
  const [trackedStatusKind, setTrackedStatusKind] = useState(status.kind)
  const isOn = state.kind === 'on'
  const reportReleaseShortcut = useEffectEvent(onReleaseShortcut)

  // A picture that stops being live ends control on this side. The socket may still be open
  // (paused), so the server is told to stop in handleSocketEvent.
  if (status.kind !== trackedStatusKind) {
    setTrackedStatusKind(status.kind)
    if (status.kind !== 'live') setState((previous) => endControl(previous, 'connection'))
  }

  const handleSocketEvent = useEffectEvent((event: ScreenSocketEvent) => {
    if (event.kind === 'control') {
      setState((previous) => applyServerControlMessage(previous, event.message))
      return
    }
    if (event.state !== 'live' && state.kind !== 'off') {
      sendMessage(RELEASE_MESSAGE)
      sendMessage(buildControlMessage(false))
    }
  })

  useEffect(() => subscribe((event) => handleSocketEvent(event)), [subscribe])

  useEffect(() => {
    const currentCanvas = canvasRef.current
    if (!isOn || !currentCanvas) return
    const canvas: HTMLCanvasElement = currentCanvas

    const controller = new AbortController()
    const { signal } = controller
    const moves = createMoveCoalescer({
      send: (point) => sendMessage(buildMoveMessage(point)),
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
    })

    function framePointOf(event: PointerEvent, clamp = false): FramePoint | null {
      return mapPointerToFrame(
        event,
        canvas.getBoundingClientRect(),
        { width: canvas.width, height: canvas.height },
        { clamp },
      )
    }

    function handlePointerMove(event: PointerEvent) {
      const point = framePointOf(event)
      if (point) moves.push(point)
    }

    function handlePointerDown(event: PointerEvent) {
      const button = toRemoteButton(event.button)
      const point = framePointOf(event)
      if (button === null || point === null) return
      moves.flush()
      canvas.setPointerCapture(event.pointerId)
      sendMessage(buildButtonMessage('down', button, point))
    }

    function handlePointerUp(event: PointerEvent) {
      const button = toRemoteButton(event.button)
      const point = framePointOf(event, true)
      if (button === null || point === null) return
      moves.flush()
      sendMessage(buildButtonMessage('up', button, point))
    }

    function handlePointerCancel() {
      moves.cancel()
      sendMessage(RELEASE_MESSAGE)
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const message = buildWheelMessage(event)
      if (message) sendMessage(message)
    }

    function handleKeyDown(event: KeyboardEvent) {
      event.preventDefault()
      if (isReleaseShortcut(event)) {
        reportReleaseShortcut()
        return
      }
      const message = buildKeyMessage(event.code, true)
      if (message) sendMessage(message)
    }

    function handleKeyUp(event: KeyboardEvent) {
      event.preventDefault()
      const message = buildKeyMessage(event.code, false)
      if (message) sendMessage(message)
    }

    function preventContextMenu(event: Event) {
      event.preventDefault()
    }

    function handleBlur() {
      sendMessage(RELEASE_MESSAGE)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') sendMessage(RELEASE_MESSAGE)
    }

    canvas.addEventListener('pointermove', handlePointerMove, { signal })
    canvas.addEventListener('pointerdown', handlePointerDown, { signal })
    canvas.addEventListener('pointerup', handlePointerUp, { signal })
    canvas.addEventListener('pointercancel', handlePointerCancel, { signal })
    canvas.addEventListener('contextmenu', preventContextMenu, { signal })
    // Non-passive so preventDefault stops the page from scrolling while the wheel controls the PC.
    canvas.addEventListener('wheel', handleWheel, { passive: false, signal })
    canvas.addEventListener('keydown', handleKeyDown, { signal })
    canvas.addEventListener('keyup', handleKeyUp, { signal })
    canvas.addEventListener('blur', handleBlur, { signal })
    document.addEventListener('visibilitychange', handleVisibilityChange, { signal })

    return () => {
      controller.abort()
      moves.cancel()
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

  function stop() {
    if (state.kind === 'off') return
    if (state.kind === 'on') sendMessage(RELEASE_MESSAGE)
    sendMessage(buildControlMessage(false))
    setState(endControl(state, 'stopped'))
  }

  return { state, start, stop }
}
