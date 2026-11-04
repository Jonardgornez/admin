import { useState } from 'react'
import { cva } from 'class-variance-authority'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { BackToDashboardLink } from '../component/layout/back-link'
import { PageHeader } from '../component/layout/page-header'
import { PcControlPanel } from '../component/pc/pc-control-panel'
import { PcStatusBadge } from '../component/pc/pc-status-badge'
import { Badge } from '../component/ui/badge'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Checkbox } from '../component/ui/choice'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import { pcs } from '../data/pcs'
import { isPcOff } from '../lib/pcs'
import type { ViewMode } from '../types'

const CAPTURE_TIME = '10:42:05'

const screenVariants = cva(
  'flex aspect-video max-h-130 w-full items-center justify-center rounded-lg bg-surface-300 p-4 text-center text-ink-subtle',
  {
    variants: {
      isControlling: {
        true: 'border-2 border-brand',
        false: 'border border-border-strong',
      },
    },
  },
)

export function ViewScreenPage() {
  const { pcName } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const [isAutoRefreshOn, setIsAutoRefreshOn] = useState(true)
  const [isControlling, setIsControlling] = useState(false)

  const pc = pcs.find((candidate) => candidate.name === pcName)
  const viewMode: ViewMode = searchParams.get('mode') === 'anonymous' ? 'anonymous' : 'notified'

  if (!pc) {
    return (
      <>
        <BackToDashboardLink />
        <PageHeader title="PC not found" />
        <p className="m-0 text-ink-muted">There is no PC named "{pcName}".</p>
      </>
    )
  }

  const isOffline = isPcOff(pc)
  const viewModeLabel = viewMode === 'notified' ? 'Notified view' : 'Anonymous view'
  const captionText = pc.user
    ? `Captured ${CAPTURE_TIME} · User ${pc.user}`
    : `Captured ${CAPTURE_TIME}`

  return (
    <>
      <BackToDashboardLink />
      <PageHeader
        title={
          <>
            <span className="font-mono">{pc.name}</span> screen
          </>
        }
        meta={
          <>
            <Badge variant="locked" icon="eye">
              {viewModeLabel}
            </Badge>
            <PcStatusBadge status={pc.status} />
            {isControlling && (
              <Badge variant="rebooting" icon="monitor">
                Controlling
              </Badge>
            )}
          </>
        }
      >
        <Button variant="secondary" disabled={isOffline} onClick={() => undefined}>
          <Icon name="refresh" />
          Refresh
        </Button>
        <label className="flex items-center gap-2 px-2">
          <Checkbox
            checked={isAutoRefreshOn}
            disabled={isOffline}
            onChange={(event) => setIsAutoRefreshOn(event.target.checked)}
          />
          Auto-refresh every 5 s
        </label>
        <Button
          variant="secondary"
          disabled={isOffline}
          onClick={() => notify(`Screenshot of ${pc.name} saved.`, 'download')}
        >
          <Icon name="download" />
          Save screenshot
        </Button>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <Icon name="x" />
          Close view
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-2">
        <div className={screenVariants({ isControlling })}>
          {isOffline
            ? "This PC is offline, so its screen can't be viewed."
            : `[Screenshot of ${pc.name}]`}
        </div>
        {!isOffline && (
          <p className="m-0 flex flex-wrap justify-between gap-2 text-xs text-ink-muted">
            <span>{captionText}</span>
            <span>Nothing is saved unless you press Save screenshot.</span>
          </p>
        )}
      </div>

      {!isControlling && viewMode === 'notified' && (
        <Banner variant="info" icon="info" title="Notified view">
          {pc.name} shows “The administrator is viewing your screen” until you close this view.
        </Banner>
      )}
      {!isControlling && viewMode === 'anonymous' && (
        <Banner variant="neutral" icon="eye" title="Anonymous view">
          {pc.name} shows no sign that you are viewing its screen.
        </Banner>
      )}

      <PcControlPanel
        pc={pc}
        isControlling={isControlling}
        onStartControl={() => setIsControlling(true)}
        onStopControl={() => setIsControlling(false)}
      />
    </>
  )
}
