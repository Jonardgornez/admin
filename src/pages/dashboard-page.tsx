import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AdminUserBlock } from '../component/layout/admin-user-block'
import { PageHeader } from '../component/layout/page-header'
import { AddTimeDialog } from '../component/pc/add-time-dialog'
import { PcBulkToolbar } from '../component/pc/pc-bulk-toolbar'
import { PcConfirmDialog } from '../component/pc/pc-confirm-dialog'
import { PcDetailDialog } from '../component/pc/pc-detail-dialog'
import { PcGrid } from '../component/pc/pc-grid'
import { SendMessageDialog } from '../component/pc/send-message-dialog'
import { Banner } from '../component/ui/banner'
import { Button, ButtonLink } from '../component/ui/button'
import { Icon } from '../component/ui/icon'
import { loginRequests } from '../data/requests'
import { pcs as initialPcs } from '../data/pcs'
import {
  countOnlinePcs,
  describeTimeGrant,
  filterPcs,
  getMessageRecipients,
  getScreenHref,
  getSelectionState,
  grantPcTime,
  isPcActionable,
  lockAllPcs,
  lockPc,
  rebootPc,
  shutDownPc,
  togglePcLock,
  toggleSelectAll,
  unlockAllPcs,
  unlockPc,
  updateActionablePcs,
} from '../lib/pcs'
import type { ApprovalChoice, Pc, PendingPcAction, ViewMode } from '../types'

const DISCONNECTED_STATE = 'disconnected'
const DISCONNECTED_LAST_SEEN = '10:44'

export function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pcs, setPcs] = useState<Pc[]>(initialPcs)
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [detailPcName, setDetailPcName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('notified')
  const [pendingAction, setPendingAction] = useState<PendingPcAction | null>(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [sentMessageCount, setSentMessageCount] = useState<number | null>(null)
  const [addTimePcName, setAddTimePcName] = useState<string | null>(null)
  const [timeGrantNotice, setTimeGrantNotice] = useState<string | null>(null)

  const isDisconnected = searchParams.get('state') === DISCONNECTED_STATE
  const detailPc = pcs.find((pc) => pc.name === detailPcName)
  const addTimePc = pcs.find((pc) => pc.name === addTimePcName)
  const actionableSelectedNames = pcs
    .filter((pc) => selectedNames.includes(pc.name) && isPcActionable(pc))
    .map((pc) => pc.name)
  const messageRecipientNames = getMessageRecipients(pcs, selectedNames)
  const visiblePcs = isDisconnected
    ? pcs.map((pc) => ({ ...pc, lastSeen: DISCONNECTED_LAST_SEEN }))
    : filterPcs(pcs, searchQuery)
  const visibleNames = visiblePcs.map((pc) => pc.name)

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

  function sendMessage() {
    setSentMessageCount(messageRecipientNames.length)
    setIsSendingMessage(false)
  }

  function grantTime(pcName: string, choice: ApprovalChoice) {
    setPcs((current) => updateActionablePcs(current, [pcName], (pc) => grantPcTime(pc, choice)))
    setTimeGrantNotice(describeTimeGrant(pcName, choice))
    setAddTimePcName(null)
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
      <div className="flex flex-col gap-6 md:sticky md:top-0 md:z-10 md:-mt-6 md:bg-surface-100 md:pt-6">
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

        {!isDisconnected && sentMessageCount !== null && (
          <Banner
            variant="info"
            icon="message"
            role="status"
            onDismiss={() => setSentMessageCount(null)}
          >
            Message sent to {sentMessageCount} {sentMessageCount === 1 ? 'PC' : 'PCs'}.
          </Banner>
        )}

        {!isDisconnected && timeGrantNotice !== null && (
          <Banner
            variant="info"
            icon="clock"
            role="status"
            onDismiss={() => setTimeGrantNotice(null)}
          >
            {timeGrantNotice}
          </Banner>
        )}

        <PcBulkToolbar
          selectionState={isDisconnected ? 'none' : getSelectionState(visibleNames, selectedNames)}
          selectedCount={isDisconnected ? 0 : actionableSelectedNames.length}
          messageRecipientCount={isDisconnected ? 0 : messageRecipientNames.length}
          hasVisiblePcs={visiblePcs.length > 0}
          isDisabled={isDisconnected}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSelectAll={() => setSelectedNames(toggleSelectAll(visibleNames, selectedNames))}
          onUnlockAll={() => setPcs(unlockAllPcs)}
          onLockAll={() => setPcs(lockAllPcs)}
          onShutdownSelected={requestShutdownSelected}
          onSendMessage={() => setIsSendingMessage(true)}
          note="Statuses below are the last known values."
        />
      </div>

      <PcGrid
        pcs={visiblePcs}
        selectedNames={isDisconnected ? [] : selectedNames}
        isDisabled={isDisconnected}
        viewMode={viewMode}
        emptyMessage={`No PCs match "${searchQuery}".`}
        onToggleSelect={toggleSelected}
        onOpenDetail={setDetailPcName}
        onToggleLock={toggleLock}
        onViewScreen={(href) => navigate(href)}
        onAddTime={setAddTimePcName}
        onShutdown={requestShutdown}
      />

      {!isDisconnected && detailPc && (
        <PcDetailDialog
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
          onAddTime={() => setAddTimePcName(detailPc.name)}
        />
      )}

      <PcConfirmDialog
        action={pendingAction}
        pcs={pcs}
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />

      {addTimePc && (
        <AddTimeDialog
          pc={addTimePc}
          onConfirm={(choice) => grantTime(addTimePc.name, choice)}
          onCancel={() => setAddTimePcName(null)}
        />
      )}

      {isSendingMessage && (
        <SendMessageDialog
          recipientNames={messageRecipientNames}
          onSend={sendMessage}
          onCancel={() => setIsSendingMessage(false)}
        />
      )}
    </>
  )
}
