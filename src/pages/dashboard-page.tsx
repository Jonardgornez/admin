import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AdminUserBlock } from '../component/layout/admin-user-block'
import { PageHeader } from '../component/layout/page-header'
import { PcBulkToolbar } from '../component/pc/pc-bulk-toolbar'
import { PcConfirmDialog } from '../component/pc/pc-confirm-dialog'
import { PcDetailPanel } from '../component/pc/pc-detail-panel'
import { PcGrid } from '../component/pc/pc-grid'
import { Banner } from '../component/ui/banner'
import { Button, ButtonLink } from '../component/ui/button'
import { Icon } from '../component/ui/icon'
import { loginRequests } from '../data/requests'
import { pcs as initialPcs } from '../data/pcs'
import {
  countOnlinePcs,
  filterPcs,
  getScreenHref,
  isPcActionable,
  lockAllPcs,
  lockPc,
  rebootPc,
  shutDownPc,
  togglePcLock,
  unlockAllPcs,
  unlockPc,
  updateActionablePcs,
} from '../lib/pcs'
import type { Pc, PendingPcAction, ViewMode } from '../types'

const DISCONNECTED_STATE = 'disconnected'
const DISCONNECTED_LAST_SEEN = '10:44'
const INITIAL_PC_NAME = 'PC-05'

export function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pcs, setPcs] = useState<Pc[]>(initialPcs)
  const [selectedNames, setSelectedNames] = useState<string[]>([INITIAL_PC_NAME])
  const [detailPcName, setDetailPcName] = useState<string | null>(INITIAL_PC_NAME)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('notified')
  const [pendingAction, setPendingAction] = useState<PendingPcAction | null>(null)
  const detailPanelRef = useRef<HTMLElement>(null)

  const isDisconnected = searchParams.get('state') === DISCONNECTED_STATE
  const detailPc = pcs.find((pc) => pc.name === detailPcName)
  const actionableSelectedNames = pcs
    .filter((pc) => selectedNames.includes(pc.name) && isPcActionable(pc))
    .map((pc) => pc.name)
  const visiblePcs = isDisconnected
    ? pcs.map((pc) => ({ ...pc, lastSeen: DISCONNECTED_LAST_SEEN }))
    : filterPcs(pcs, searchQuery)

  function retryConnection() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('state')
      return next
    })
  }

  function toggleSelected(pcName: string) {
    setSelectedNames((current) =>
      current.includes(pcName) ? current.filter((name) => name !== pcName) : [...current, pcName],
    )
  }

  function toggleLock(pcName: string) {
    setPcs((current) => current.map((pc) => (pc.name === pcName ? togglePcLock(pc) : pc)))
  }

  function requestShutdown(pcName: string) {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    if (pc && isPcActionable(pc)) setPendingAction({ kind: 'shutdown', pcName })
  }

  function requestShutdownSelected() {
    setPendingAction({ kind: 'shutdown-selected', pcNames: actionableSelectedNames })
  }

  function openDetail(pcName: string) {
    setDetailPcName(pcName)
    requestAnimationFrame(() => detailPanelRef.current?.scrollIntoView({ block: 'nearest' }))
  }

  function confirmPendingAction() {
    if (!pendingAction) return
    if (pendingAction.kind === 'reboot') {
      setPcs((current) => updateActionablePcs(current, [pendingAction.pcName], rebootPc))
    } else if (pendingAction.kind === 'shutdown') {
      setPcs((current) => updateActionablePcs(current, [pendingAction.pcName], shutDownPc))
    } else {
      setPcs((current) => updateActionablePcs(current, pendingAction.pcNames, shutDownPc))
      setSelectedNames([])
    }
    setPendingAction(null)
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        meta={
          <span className="text-ink-muted">
            {isDisconnected
              ? 'Last update 10:44:12'
              : `${countOnlinePcs(pcs)} of ${pcs.length} PCs online`}
          </span>
        }
      >
        {isDisconnected ? (
          <Button variant="secondary" onClick={retryConnection}>
            <Icon name="refresh" />
            Retry now
          </Button>
        ) : (
          <ButtonLink to="/requests" variant="secondary">
            <Icon name="bell" />
            {loginRequests.length} requests
          </ButtonLink>
        )}
        <AdminUserBlock />
      </PageHeader>

      {isDisconnected && (
        <Banner variant="danger" icon="alert" role="alert" title="Disconnected">
          The console lost its connection to the server program. Controls are turned off so no
          command is sent blindly. Reconnecting automatically…
        </Banner>
      )}

      <PcBulkToolbar
        selectedCount={isDisconnected ? 0 : actionableSelectedNames.length}
        isDisabled={isDisconnected}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUnlockAll={() => setPcs(unlockAllPcs)}
        onLockAll={() => setPcs(lockAllPcs)}
        onShutdownSelected={requestShutdownSelected}
        onSendMessage={() => undefined}
        note="Statuses below are the last known values."
      />

      <div className="flex flex-wrap items-start gap-5">
        <PcGrid
          pcs={visiblePcs}
          selectedNames={isDisconnected ? [] : selectedNames}
          isDisabled={isDisconnected}
          viewMode={viewMode}
          emptyMessage={`No PCs match "${searchQuery}".`}
          onToggleSelect={toggleSelected}
          onOpenDetail={openDetail}
          onToggleLock={toggleLock}
          onViewScreen={(href) => navigate(href)}
          onShutdown={requestShutdown}
        />
        {!isDisconnected && detailPc && (
          <PcDetailPanel
            ref={detailPanelRef}
            pc={detailPc}
            viewMode={viewMode}
            screenHref={getScreenHref(detailPc.name, viewMode)}
            onViewModeChange={setViewMode}
            onClose={() => setDetailPcName(null)}
            onLock={() => setPcs((current) => updateActionablePcs(current, [detailPc.name], lockPc))}
            onUnlock={() =>
              setPcs((current) => updateActionablePcs(current, [detailPc.name], unlockPc))
            }
            onReboot={() => setPendingAction({ kind: 'reboot', pcName: detailPc.name })}
            onShutdown={() => requestShutdown(detailPc.name)}
          />
        )}
      </div>

      <PcConfirmDialog
        action={pendingAction}
        pcs={pcs}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  )
}
