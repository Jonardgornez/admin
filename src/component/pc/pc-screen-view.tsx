import { useEffect, useRef, useState } from 'react'
import { cva } from 'class-variance-authority'
import pcScreenMockImage from '../../assets/pc-screen-mock.jpg'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useNotify } from '../ui/notification-context'

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
  viewModeLabel: string
  captionText: string
  onStopControl: () => void
}

export function PcScreenView({
  pcName,
  isOffline,
  isControlling,
  viewModeLabel,
  captionText,
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
              <Button variant="secondary" onClick={stopControl}>
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
        {isOffline ? (
          <p className="m-0 p-4">This PC is offline, so its screen can't be viewed.</p>
        ) : (
          <img
            src={pcScreenMockImage}
            alt={`Screenshot of ${pcName}`}
            width={1920}
            height={1032}
            className="size-full object-contain"
          />
        )}
      </div>
      {!isFullView && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!isOffline && (
            <p className="m-0 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              <span>{captionText}</span>
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
