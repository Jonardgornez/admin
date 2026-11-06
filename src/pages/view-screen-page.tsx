import { useEffect, useState } from 'react'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { BackToDashboardLink } from '../component/layout/back-link'
import { useNavigationLock } from '../component/layout/navigation-lock-context'
import { PageHeader } from '../component/layout/page-header'
import { PcControlPanel } from '../component/pc/pc-control-panel'
import { PcScreenView } from '../component/pc/pc-screen-view'
import { PcStatusBadge } from '../component/pc/pc-status-badge'
import { saveCanvasAsPng } from '../component/pc/screen-screenshot'
import { ScreenEndedBanner } from '../component/pc/screen-ended-banner'
import { ScreenStatusBadge } from '../component/pc/screen-status-badge'
import { usePcs } from '../component/pc/use-pcs'
import { useScreenStream } from '../component/pc/use-screen-stream'
import { Badge } from '../component/ui/badge'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import { canViewPcScreen } from '../lib/pcs'
import { buildScreenshotFilename, getScreenPlaceholderText } from '../lib/screen-stream'
import type { ViewMode } from '../types'

export function ViewScreenPage() {
  const { pcName } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const { pcs, loadState, retry } = usePcs()
  const [isControlling, setIsControlling] = useState(false)
  const { setIsNavigationLocked } = useNavigationLock()
  const navigationBlocker = useBlocker(isControlling)

  const pc = pcs.find((candidate) => candidate.name === pcName)
  const isOffline = pc !== undefined && !canViewPcScreen(pc)
  const viewMode: ViewMode = searchParams.get('mode') === 'anonymous' ? 'anonymous' : 'notified'
  const screen = useScreenStream({
    pcId: pc && !isOffline ? pc.id : null,
    mode: viewMode,
    onRefused: retry,
  })
  // A paused screen is a protected one, so the last picture is not shown as if it were current.
  const isFrameVisible = screen.hasFrame && !isOffline && screen.status.kind !== 'paused'
  const endedMessage = screen.status.kind === 'ended' ? screen.status.message : null

  useEffect(() => {
    setIsNavigationLocked(isControlling)
    return () => setIsNavigationLocked(false)
  }, [isControlling, setIsNavigationLocked])

  useEffect(() => {
    if (navigationBlocker.state !== 'blocked') return
    navigationBlocker.reset()
    notify('Stop control before leaving this page.', 'alert')
  }, [navigationBlocker, notify])

  if (loadState.status === 'loading') {
    return (
      <>
        <BackToDashboardLink />
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading PC...
        </p>
      </>
    )
  }

  if (loadState.status === 'error') {
    return (
      <>
        <BackToDashboardLink />
        <Banner variant="danger" icon="alert" role="alert" title="Can't load this PC">
          {loadState.error}
        </Banner>
        <Button variant="secondary" onClick={retry}>
          <Icon name="refresh" />
          Retry
        </Button>
      </>
    )
  }

  if (!pc) {
    return (
      <>
        <BackToDashboardLink />
        <PageHeader title="PC not found" />
        <p className="m-0 text-ink-muted">There is no PC named "{pcName}".</p>
      </>
    )
  }

  const viewModeLabel = viewMode === 'notified' ? 'Notified view' : 'Anonymous view'
  const captionText = pc.user ? `User ${pc.user}` : undefined

  const saveScreenshot = async () => {
    const canvas = screen.canvasRef.current
    const isSaved =
      canvas !== null && (await saveCanvasAsPng(canvas, buildScreenshotFilename(pc.name, new Date())))
    if (isSaved) notify(`Screenshot of ${pc.name} saved.`, 'download')
    else notify("Couldn't save the screenshot.", 'alert')
  }

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
            <PcStatusBadge pc={pc} />
            {!isOffline && <ScreenStatusBadge status={screen.status} />}
            {isControlling && (
              <Badge variant="rebooting" icon="monitor">
                Controlling
              </Badge>
            )}
          </>
        }
      >
        <Button variant="secondary" disabled={!isFrameVisible} onClick={() => void saveScreenshot()}>
          <Icon name="download" />
          Save screenshot
        </Button>
        <Button variant="ghost" disabled={isControlling} onClick={() => navigate('/dashboard')}>
          <Icon name="x" />
          Close view
        </Button>
      </PageHeader>

      {endedMessage && (
        <ScreenEndedBanner
          message={endedMessage}
          canReconnect={!isOffline}
          onReconnect={screen.reconnect}
        />
      )}

      <PcScreenView
        pcName={pc.name}
        isOffline={isOffline}
        isControlling={isControlling}
        isFrameVisible={isFrameVisible}
        placeholderText={getScreenPlaceholderText(screen.status)}
        viewModeLabel={viewModeLabel}
        captionText={captionText}
        canvasRef={screen.canvasRef}
        onStopControl={() => setIsControlling(false)}
      />

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
