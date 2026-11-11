import { useEffect, useRef, useState } from 'react'
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
import { useRemoteControl } from '../component/pc/use-remote-control'
import { useScreenStream } from '../component/pc/use-screen-stream'
import { Badge } from '../component/ui/badge'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import { canViewPcScreen } from '../lib/pcs'
import { getTakeControlBlockMessage } from '../lib/remote-control'
import { buildScreenshotFilename, getScreenPlaceholderText } from '../lib/screen-stream'
import type { ViewMode } from '../types'

export function ViewScreenPage() {
  const { pcName } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const notify = useNotify()
  const { pcs, loadState, retry } = usePcs()
  const { setIsNavigationLocked } = useNavigationLock()
  const panelStopButtonRef = useRef<HTMLButtonElement>(null)
  const screenStopButtonRef = useRef<HTMLButtonElement>(null)
  const [hasUsedReleaseShortcut, setHasUsedReleaseShortcut] = useState(false)

  const pc = pcs.find((candidate) => candidate.name === pcName)
  const isOffline = pc !== undefined && !canViewPcScreen(pc)
  const viewMode: ViewMode = searchParams.get('mode') === 'anonymous' ? 'anonymous' : 'notified'
  const screen = useScreenStream({
    pcId: pc && !isOffline ? pc.id : null,
    mode: viewMode,
    onRefused: retry,
  })

  function focusStopControl() {
    setHasUsedReleaseShortcut(true)
    const stopButton = screenStopButtonRef.current ?? panelStopButtonRef.current
    stopButton?.focus()
  }

  const control = useRemoteControl({ screen, onReleaseShortcut: focusStopControl })
  const isControlling = control.state.kind === 'on'
  const isControlActive = isControlling || control.state.kind === 'requesting'
  const navigationBlocker = useBlocker(isControlActive)

  // The last picture is shown or saved only while the stream is live, never as if it were current.
  const isFrameVisible = screen.hasFrame && !isOffline && screen.status.kind === 'live'
  const endedMessage = screen.status.kind === 'ended' ? screen.status.message : null

  useEffect(() => {
    setIsNavigationLocked(isControlActive)
    return () => setIsNavigationLocked(false)
  }, [isControlActive, setIsNavigationLocked])

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
  const takeControlBlockMessage = getTakeControlBlockMessage(pc, screen.status)

  const saveScreenshot = async () => {
    const canvas = screen.canvasRef.current
    const isSaved =
      canvas !== null && (await saveCanvasAsPng(canvas, buildScreenshotFilename(pc.name, new Date())))
    if (isSaved) notify(`Screenshot of ${pc.name} saved.`, 'download')
    else notify("Couldn't save the screenshot.", 'alert')
  }

  function startControl() {
    setHasUsedReleaseShortcut(false)
    control.start()
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
        <Button variant="ghost" disabled={isControlActive} onClick={() => navigate('/dashboard')}>
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
        isStopHintShown={isControlling && hasUsedReleaseShortcut}
        isFrameVisible={isFrameVisible}
        placeholderText={getScreenPlaceholderText(screen.status)}
        viewModeLabel={viewModeLabel}
        captionText={captionText}
        canvasRef={screen.canvasRef}
        stopButtonRef={screenStopButtonRef}
        onStopControl={control.stop}
        onSendSecureAttention={control.sendSecureAttention}
      />

      {!isControlling && viewMode === 'notified' && (
        <Banner variant="info" icon="info" title="Notified view">
          {pc.name} shows “The administrator is viewing your screen” until you close this view.
        </Banner>
      )}
      {!isControlling && viewMode === 'anonymous' && (
        <Banner variant="neutral" icon="eye" title="Anonymous view">
          {pc.name} shows no sign that you are viewing or controlling it. If you take control, the
          user can still see the mouse move and typing appear.
        </Banner>
      )}

      <PcControlPanel
        pc={pc}
        viewMode={viewMode}
        control={control.state}
        takeControlBlockMessage={takeControlBlockMessage}
        isCoolingDown={control.isCoolingDown}
        stopButtonRef={panelStopButtonRef}
        onStartControl={startControl}
        onStopControl={control.stop}
      />
    </>
  )
}
