import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import { SESSION_EXPIRED_NOTICE } from '../../lib/auth-state'
import {
  TILE_ACK_DELAY_MS,
  TILE_ELSEWHERE_RETRY_MS,
  VIEWED_ELSEWHERE_TEXT,
} from '../../lib/screen-grid'
import {
  BUSY_CLOSE_CODE,
  buildScreenStreamUrl,
  describeScreenClose,
  getScreenRetryDelayMs,
  isPictureScreenState,
  REPLACED_CLOSE_CODE,
  type ScreenStreamStatus,
} from '../../lib/screen-stream'
import type { ViewMode } from '../../types'
import { useAuth } from '../auth/auth-context'
import { openScreenConnection } from '../pc/screen-connection'

// Coming into view connects soon; leaving it waits longer, so scrolling past doesn't close and reopen sockets.
export const TILE_SHOW_DELAY_MS = 250
export const TILE_HIDE_DELAY_MS = 1000

export const TILE_REFUSED_MESSAGE = "Couldn't open the screen."

interface UseScreenTileOptions {
  pcId: number
  mode: ViewMode
}

interface TileState {
  status: ScreenStreamStatus
  isViewedElsewhere: boolean
  hasFrame: boolean
}

export interface ScreenTile {
  tileRef: RefObject<HTMLLIElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  status: ScreenStreamStatus
  // The PC already has as many views as it may have, so this tile waits and checks again every few seconds.
  isViewedElsewhere: boolean
  isFrameVisible: boolean
  reconnect: () => void
  // Opens once as a full view, which takes the place of another tile's view when the PC has too many.
  takeOver: () => void
}

const CONNECTING_STATUS: ScreenStreamStatus = { kind: 'connecting' }
const ELSEWHERE_STATUS: ScreenStreamStatus = { kind: 'ended', message: VIEWED_ELSEWHERE_TEXT }
const INITIAL_STATE: TileState = {
  status: CONNECTING_STATUS,
  isViewedElsewhere: false,
  hasFrame: false,
}

function withStatus(previous: TileState, status: ScreenStreamStatus): TileState {
  return { ...previous, status }
}

// True while the element is on screen and the tab is shown, after a short settle time.
// Without IntersectionObserver the element counts as on screen.
export function useDebouncedVisibility(elementRef: RefObject<Element | null>): boolean {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    const canObserve = typeof IntersectionObserver !== 'undefined'
    const tracked = {
      isOnScreen: !canObserve,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    }

    function scheduleUpdate() {
      const next = tracked.isOnScreen && !document.hidden
      clearTimeout(tracked.timer)
      tracked.timer = setTimeout(() => setIsVisible(next), next ? TILE_SHOW_DELAY_MS : TILE_HIDE_DELAY_MS)
    }

    const observer = canObserve
      ? new IntersectionObserver((entries) => {
          const latest = entries.at(-1)
          if (!latest) return
          tracked.isOnScreen = latest.isIntersecting
          scheduleUpdate()
        })
      : null
    observer?.observe(element)
    document.addEventListener('visibilitychange', scheduleUpdate)
    if (!canObserve) scheduleUpdate()

    return () => {
      clearTimeout(tracked.timer)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', scheduleUpdate)
    }
  }, [elementRef])

  return isVisible
}

// One live connection for one grid tile. Frames are acked late, so the PC sends about one a second
// at its smallest size. The connection is closed while the tile is off screen or the tab is hidden.
// Tiles open passively and share the PC's stream with its other views, so they never take another view's place.
// Only Take over opens a full view, once.
export function useScreenTile({ pcId, mode }: UseScreenTileOptions): ScreenTile {
  const { markSignedOut } = useAuth()
  const tileRef = useRef<HTMLLIElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isVisible = useDebouncedVisibility(tileRef)
  const [state, setState] = useState<TileState>(INITIAL_STATE)
  const [attempt, setAttempt] = useState(0)
  // True only for the connection that Take over asked for. Any later connection is passive again.
  const [isTakingOver, setIsTakingOver] = useState(false)
  const [trackedMode, setTrackedMode] = useState(mode)
  const [wasVisible, setWasVisible] = useState(isVisible)
  const automaticRetriesRef = useRef(0)
  const retriesModeRef = useRef(mode)
  const endExpiredSession = useEffectEvent(() => markSignedOut(SESSION_EXPIRED_NOTICE))
  const isEnded = state.status.kind === 'ended'

  // Adjusted while rendering, so a new mode or a return into view never shows the old status.
  if (mode !== trackedMode) {
    setTrackedMode(mode)
    setState(INITIAL_STATE)
    setIsTakingOver(false)
  }
  if (isVisible !== wasVisible) {
    setWasVisible(isVisible)
    setIsTakingOver(false)
    if (isVisible) {
      setState((previous) =>
        previous.status.kind === 'ended' ? previous : withStatus(previous, CONNECTING_STATUS),
      )
    }
  }

  const connectAgain = useCallback(() => {
    setIsTakingOver(false)
    setAttempt((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!isVisible || isEnded) return
    const retry = { timer: undefined as ReturnType<typeof setTimeout> | undefined }
    const isPassive = !isTakingOver

    if (retriesModeRef.current !== mode) {
      retriesModeRef.current = mode
      automaticRetriesRef.current = 0
    }

    function showViewedElsewhere() {
      setState((previous) => ({ ...previous, status: ELSEWHERE_STATUS, isViewedElsewhere: true }))
    }

    function handleClose(code: number, wasOpen: boolean) {
      // Browsers hide why an upgrade was refused. For a passive tile the usual reason is a PC
      // with too many views (409); an offline PC or an ended session is caught by the PC list poll.
      if (!wasOpen) {
        if (isPassive) showViewedElsewhere()
        else setState((previous) => withStatus(previous, { kind: 'ended', message: TILE_REFUSED_MESSAGE }))
        return
      }
      if (code === BUSY_CLOSE_CODE || code === REPLACED_CLOSE_CODE) {
        showViewedElsewhere()
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
      retry.timer = setTimeout(connectAgain, delay)
    }

    const connection = openScreenConnection({
      url: buildScreenStreamUrl(window.location, pcId, mode, isPassive),
      getCanvas: () => canvasRef.current,
      onServerState: (serverState) => {
        if (serverState === 'live') automaticRetriesRef.current = 0
        setState((previous) => ({
          ...previous,
          status: { kind: serverState },
          isViewedElsewhere: false,
        }))
      },
      // A tile is view-only, so control and cursor messages are ignored.
      onControlMessage: () => undefined,
      onCursorMessage: () => undefined,
      onFrameDrawn: () => setState((previous) => ({ ...previous, hasFrame: true })),
      onClose: handleClose,
      ackDelayMs: TILE_ACK_DELAY_MS,
    })

    return () => {
      clearTimeout(retry.timer)
      connection.close()
    }
  }, [pcId, mode, attempt, isVisible, isEnded, isTakingOver, connectAgain])

  // While the PC has too many views, a passive connection checks again now and then.
  useEffect(() => {
    if (!isVisible || !isEnded || !state.isViewedElsewhere) return
    const timer = setTimeout(() => {
      setState((previous) => withStatus(previous, CONNECTING_STATUS))
      connectAgain()
    }, TILE_ELSEWHERE_RETRY_MS)
    return () => clearTimeout(timer)
  }, [isVisible, isEnded, state.isViewedElsewhere, connectAgain])

  const reconnect = useCallback(() => {
    automaticRetriesRef.current = 0
    setState((previous) => ({ ...previous, status: CONNECTING_STATUS, isViewedElsewhere: false }))
    connectAgain()
  }, [connectAgain])

  const takeOver = useCallback(() => {
    automaticRetriesRef.current = 0
    setState((previous) => ({ ...previous, status: CONNECTING_STATUS, isViewedElsewhere: false }))
    setIsTakingOver(true)
    setAttempt((current) => current + 1)
  }, [])

  return {
    tileRef,
    canvasRef,
    status: state.status,
    isViewedElsewhere: state.isViewedElsewhere,
    isFrameVisible: state.hasFrame && isPictureScreenState(state.status.kind),
    reconnect,
    takeOver,
  }
}
