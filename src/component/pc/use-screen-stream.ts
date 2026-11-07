import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import { SESSION_EXPIRED_NOTICE } from '../../lib/auth-state'
import {
  buildScreenStreamUrl,
  describeScreenClose,
  getScreenRetryDelayMs,
  isActiveScreenStatus,
  PC_GONE_MESSAGE,
  SCREEN_REFUSED_MESSAGE,
  type ScreenSize,
  type ScreenStreamStatus,
  type ServerScreenState,
} from '../../lib/screen-stream'
import type { ViewMode } from '../../types'
import { useAuth } from '../auth/auth-context'
import type { ServerControlMessage } from '../../lib/remote-input'
import { openScreenConnection, type ScreenConnection } from './screen-connection'

interface UseScreenStreamOptions {
  // Null means no PC is being viewed, so no socket is open.
  pcId: number | null
  mode: ViewMode
  onRefused: () => void
}

// Control messages and server states, delivered as they arrive on the socket.
export type ScreenSocketEvent =
  | { kind: 'server-state'; state: ServerScreenState }
  | { kind: 'control'; message: ServerControlMessage }

export type ScreenSocketListener = (event: ScreenSocketEvent) => void

export interface ScreenStream {
  canvasRef: RefObject<HTMLCanvasElement | null>
  status: ScreenStreamStatus
  hasFrame: boolean
  reconnect: () => void
  // Resolves false when the socket is not open, so nothing was sent.
  sendMessage: (message: string) => boolean
  subscribe: (listener: ScreenSocketListener) => () => void
}

interface ScreenStreamState {
  status: ScreenStreamStatus
  size: ScreenSize | null
}

const INITIAL_STATE: ScreenStreamState = { status: { kind: 'idle' }, size: null }
const CONNECTING_STATUS: ScreenStreamStatus = { kind: 'connecting' }
const PC_GONE_STATUS: ScreenStreamStatus = { kind: 'ended', message: PC_GONE_MESSAGE }
const REFUSED_STATUS: ScreenStreamStatus = { kind: 'ended', message: SCREEN_REFUSED_MESSAGE }

function withStatus(previous: ScreenStreamState, status: ScreenStreamStatus): ScreenStreamState {
  return { ...previous, status }
}

// A new PC or mode starts with no picture. If the PC left the list mid-stream, the stream
// reports that the PC went away, the same as a server close with 4002.
function stateForTarget(previous: ScreenStreamState, pcId: number | null): ScreenStreamState {
  if (pcId !== null) return { status: CONNECTING_STATUS, size: null }
  return isActiveScreenStatus(previous.status) ? withStatus(previous, PC_GONE_STATUS) : previous
}

// One socket per (pcId, mode). Frames go straight to the canvas, so drawing does not re-render
// the page. React state changes only for status and size changes.
export function useScreenStream({ pcId, mode, onRefused }: UseScreenStreamOptions): ScreenStream {
  const { markSignedOut } = useAuth()
  const [state, setState] = useState<ScreenStreamState>(INITIAL_STATE)
  const [attempt, setAttempt] = useState(0)
  const target = pcId === null ? null : `${pcId}:${mode}`
  const [trackedTarget, setTrackedTarget] = useState(target)
  const [socketListeners] = useState(() => new Set<ScreenSocketListener>())
  const connectionRef = useRef<ScreenConnection | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const automaticRetriesRef = useRef(0)
  const retriesTargetRef = useRef<string | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reportRefused = useEffectEvent(onRefused)
  const endExpiredSession = useEffectEvent(() => markSignedOut(SESSION_EXPIRED_NOTICE))

  // Adjusting state while rendering (rather than in an effect) avoids an extra render pass.
  if (target !== trackedTarget) {
    setTrackedTarget(target)
    setState((previous) => stateForTarget(previous, pcId))
  }

  useEffect(() => {
    if (pcId === null) return

    // A different PC or mode gets its own retries.
    const connectionTarget = `${pcId}:${mode}`
    if (retriesTargetRef.current !== connectionTarget) {
      retriesTargetRef.current = connectionTarget
      automaticRetriesRef.current = 0
    }

    function handleClose(code: number, wasOpen: boolean) {
      if (!wasOpen) {
        // The server refused the upgrade. Browsers hide why, so the page checks the PC list.
        setState((previous) => withStatus(previous, REFUSED_STATUS))
        reportRefused()
        return
      }
      const outcome = describeScreenClose(code)
      if (outcome.isSessionEnded) {
        endExpiredSession()
        return
      }
      const delay = outcome.canRetry ? getScreenRetryDelayMs(automaticRetriesRef.current + 1) : null
      if (delay === null) {
        setState((previous) => withStatus(previous, { kind: 'ended', message: outcome.message }))
        return
      }
      automaticRetriesRef.current += 1
      setState((previous) => withStatus(previous, CONNECTING_STATUS))
      retryTimerRef.current = setTimeout(() => setAttempt((current) => current + 1), delay)
    }

    function notifyListeners(event: ScreenSocketEvent) {
      socketListeners.forEach((listener) => listener(event))
    }

    const connection = openScreenConnection({
      url: buildScreenStreamUrl(window.location, pcId, mode),
      getCanvas: () => canvasRef.current,
      onServerState: (serverState: ServerScreenState) => {
        // Only a live PC proves the connection is healthy. Every new socket starts with "waiting",
        // so counting that as healthy would let a failing view retry forever.
        if (serverState === 'live') automaticRetriesRef.current = 0
        setState((previous) => withStatus(previous, { kind: serverState }))
        notifyListeners({ kind: 'server-state', state: serverState })
      },
      onControlMessage: (message) => notifyListeners({ kind: 'control', message }),
      onFrameDrawn: (size) => setState((previous) => ({ ...previous, size })),
      onClose: handleClose,
    })
    connectionRef.current = connection

    return () => {
      clearTimeout(retryTimerRef.current)
      connectionRef.current = null
      connection.close()
    }
  }, [pcId, mode, attempt, socketListeners])

  const reconnect = useCallback(() => {
    automaticRetriesRef.current = 0
    setState((previous) => withStatus(previous, CONNECTING_STATUS))
    setAttempt((current) => current + 1)
  }, [])

  const sendMessage = useCallback(
    (message: string) => connectionRef.current?.send(message) ?? false,
    [],
  )

  const subscribe = useCallback(
    (listener: ScreenSocketListener) => {
      socketListeners.add(listener)
      return () => {
        socketListeners.delete(listener)
      }
    },
    [socketListeners],
  )

  return {
    canvasRef,
    status: state.status,
    hasFrame: state.size !== null,
    reconnect,
    sendMessage,
    subscribe,
  }
}
