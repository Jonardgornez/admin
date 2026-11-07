import { useEffect, useRef, useState, type RefObject } from 'react'
import { cva } from 'class-variance-authority'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useNotify } from '../ui/notification-context'
import { getKeyboardLock } from '../../lib/keyboard-lock'

const RELEASE_HINT = 'Press Ctrl+Alt+Shift+X to release the keyboard.'
const STOP_HINT = 'Stop control is focused. Press Enter to stop control.'

const containerVariants = cva('flex flex-col', {
  variants: {
    isFullView: {
      true: 'h-full gap-3 bg-surface-100 p-4',
      false: 'gap-2',
    },
  },
})

const screenVariants = cva(
  'flex w-full items-center justify-center overflow-hidden rounded-lg bg-surface-300 text-center text-ink-subtle',
  {
    variants: {
      isControlling: {
        true: 'border-2 border-brand',
        false: 'border border-border-strong',
      },
      isFullView: {
        true: 'min-h-0 flex-1',
        false: 'aspect-video max-h-130',
      },
    },
  },
)

interface PcScreenViewProps {
  pcName: string
  isOffline: boolean
  isControlling: boolean
  isStopHintShown: boolean
  isFrameVisible: boolean
  placeholderText: string
  viewModeLabel: string
  captionText?: string
  canvasRef: RefObject<HTMLCanvasElement | null>
  stopButtonRef: RefObject<HTMLButtonElement | null>
  onStopControl: () => void
}

export function PcScreenView({
  pcName,
  isOffline,
  isControlling,
  isStopHintShown,
  isFrameVisible,
  placeholderText,
  viewModeLabel,
  captionText,
  canvasRef,
  stopButtonRef,
  onStopControl,
}: PcScreenViewProps) {
  const notify = useNotify()
  const containerRef = useRef<HTMLDivElement>(null)
  const fullViewButtonRef = useRef<HTMLButtonElement>(null)
  const exitButtonRef = useRef<HTMLButtonElement>(null)
  const hasEnteredFullViewRef = useRef(false)
  const [isFullView, setIsFullView] = useState(false)

  useEffect(() => {
    function syncFullView() {
      setIsFullView(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', syncFullView)
    return () => document.removeEventListener('fullscreenchange', syncFullView)
  }, [])

  useEffect(() => {
    if (isFullView) {
      hasEnteredFullViewRef.current = true
      exitButtonRef.current?.focus()
    } else if (hasEnteredFullViewRef.current) {
      fullViewButtonRef.current?.focus()
    }
  }, [isFullView])

  // Keys go to the PC only while the screen has focus.
  useEffect(() => {
    if (isControlling) canvasRef.current?.focus()
  }, [isControlling, canvasRef])

  // Chromium locks the keyboard only in full view, so Alt+Tab and similar keys reach the PC.
  useEffect(() => {
    if (!isControlling || !isFullView) return
    const keyboard = getKeyboardLock(navigator)
    void keyboard?.lock().catch(() => undefined)
    return () => keyboard?.unlock()
  }, [isControlling, isFullView])

  async function enterFullView() {
    try {
      await containerRef.current?.requestFullscreen()
    } catch {
      notify("Couldn't open full view.", 'alert')
    }
  }

  function stopControl() {
    onStopControl()
    exitButtonRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={containerVariants({ isFullView })}>
      {isFullView && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold">{pcName}</span>
            <Badge variant="locked" icon="eye">
              {viewModeLabel}
            </Badge>
            {isControlling && (
              <Badge variant="rebooting" icon="monitor">
                Controlling
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isControlling && (
              <Button ref={stopButtonRef} variant="secondary" onClick={stopControl}>
                <Icon name="x" />
                Stop control
              </Button>
            )}
            <Button
              ref={exitButtonRef}
              variant="secondary"
              onClick={() => void document.exitFullscreen().catch(() => undefined)}
            >
              <Icon name="collapse" />
              Exit full view
            </Button>
          </div>
        </div>
      )}
      <div className={screenVariants({ isControlling, isFullView })}>
        {/* The canvas stays mounted so its last frame survives a placeholder. */}
        <canvas
          ref={canvasRef}
          role={isControlling ? 'application' : 'img'}
          aria-label={
            isControlling
              ? `Remote control of ${pcName}. Your keyboard and mouse control this PC.`
              : `Live screen of ${pcName}`
          }
          tabIndex={isControlling ? 0 : undefined}
          hidden={!isFrameVisible}
          className="size-full object-contain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        {isOffline && <p className="m-0 p-4">This PC is offline, so its screen can't be viewed.</p>}
        {!isOffline && !isFrameVisible && (
          <p role="status" className="m-0 p-4">
            {placeholderText}
          </p>
        )}
      </div>
      {isControlling && (
        <p role="status" className="m-0 text-sm text-ink-muted">
          {isStopHintShown ? STOP_HINT : RELEASE_HINT}
        </p>
      )}
      {!isFullView && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!isOffline && (
            <p className="m-0 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {captionText && <span>{captionText}</span>}
              <span>Nothing is saved unless you press Save screenshot.</span>
            </p>
          )}
          <Button
            ref={fullViewButtonRef}
            variant="secondary"
            disabled={isOffline}
            className="ml-auto"
            onClick={() => void enterFullView()}
          >
            <Icon name="expand" />
            Full view
          </Button>
        </div>
      )}
    </div>
  )
}
