import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '../component/layout/page-header'
import { AddTimeDialog } from '../component/pc/add-time-dialog'
import { PcBulkToolbar } from '../component/pc/pc-bulk-toolbar'
import { PcConfirmDialog } from '../component/pc/pc-confirm-dialog'
import { PcDetailDialog } from '../component/pc/pc-detail-dialog'
import { PcGrid } from '../component/pc/pc-grid'
import { RestrictionsDialog } from '../component/pc/restrictions-dialog'
import { SendMessageDialog } from '../component/pc/send-message-dialog'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import { pcs as initialPcs } from '../data/pcs'
import {
  countChangedPcs,
  countOnlinePcs,
  describeTimeGrant,
  filterPcs,
  formatPcCount,
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
import { applyRestrictions, describeRestrictionsApplied } from '../lib/restrictions'
import type { ApprovalChoice, Pc, PcRestrictions, PendingPcAction, ViewMode } from '../types'

const DISCONNECTED_STATE = 'disconnected'
const DISCONNECTED_LAST_SEEN = '10:44'

export function DashboardPage() {
  const navigate = useNavigate()
  const notify = useNotify()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pcs, setPcs] = useState<Pc[]>(initialPcs)
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [detailPcName, setDetailPcName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('notified')
  const [pendingAction, setPendingAction] = useState<PendingPcAction | null>(null)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [addTimePcName, setAddTimePcName] = useState<string | null>(null)
  const [isEditingRestrictions, setIsEditingRestrictions] = useState(false)

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
    const pc = pcs.find((candidate) => candidate.name === pcName)
    if (!pc) return
    const updatedPc = togglePcLock(pc)
    if (updatedPc.status === pc.status) return
    setPcs((current) => current.map((item) => (item.name === pcName ? updatedPc : item)))
    if (updatedPc.status === 'locked') {
      notify(`${pcName} locked.`, 'lock')
    } else {
      notify(`${pcName} unlocked.`, 'unlock')
    }
  }

  function lockDetailPc(pcName: string) {
    setPcs((current) => updateActionablePcs(current, [pcName], lockPc))
    notify(`${pcName} locked.`, 'lock')
  }

  function unlockDetailPc(pcName: string) {
    setPcs((current) => updateActionablePcs(current, [pcName], unlockPc))
    notify(`${pcName} unlocked.`, 'unlock')
  }

  function lockAll() {
    const updatedPcs = lockAllPcs(pcs)
    const changedCount = countChangedPcs(pcs, updatedPcs)
    setPcs(updatedPcs)
    if (changedCount > 0) notify(`Locked ${formatPcCount(changedCount)}.`, 'lock')
  }

  function unlockAll() {
    const updatedPcs = unlockAllPcs(pcs)
    const changedCount = countChangedPcs(pcs, updatedPcs)
    setPcs(updatedPcs)
    if (changedCount > 0) notify(`Unlocked ${formatPcCount(changedCount)}.`, 'unlock')
  }

  function requestShutdown(pcName: string) {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    if (pc && isPcActionable(pc)) setPendingAction({ kind: 'shutdown', pcName })
  }

  function requestShutdownSelected() {
    setPendingAction({ kind: 'shutdown-selected', pcNames: actionableSelectedNames })
  }

  function sendMessage() {
    notify(`Message sent to ${formatPcCount(messageRecipientNames.length)}.`, 'message')
    setIsSendingMessage(false)
  }

  function applyPcRestrictions(restrictions: PcRestrictions, appliesWithoutRestart: boolean) {
    setPcs((current) => applyRestrictions(current, selectedNames, restrictions))
    notify(
      describeRestrictionsApplied(selectedNames.length, restrictions, appliesWithoutRestart),
      'shield',
    )
    setIsEditingRestrictions(false)
  }

  function grantTime(pcName: string, choice: ApprovalChoice) {
    setPcs((current) => updateActionablePcs(current, [pcName], (pc) => grantPcTime(pc, choice)))
    notify(describeTimeGrant(pcName, choice), 'clock')
    setAddTimePcName(null)
  }

  function timeOut(pcName: string) {
    setPcs((current) => updateActionablePcs(current, [pcName], lockPc))
    notify(`${pcName} timed out. Its session has ended.`, 'hourglass')
    setAddTimePcName(null)
  }

  function confirmPendingAction() {
    if (!pendingAction) return
    if (pendingAction.kind === 'reboot') {
      setPcs((current) => updateActionablePcs(current, [pendingAction.pcName], rebootPc))
      notify(`${pendingAction.pcName} is rebooting.`, 'refresh')
    } else if (pendingAction.kind === 'shutdown') {
      setPcs((current) => updateActionablePcs(current, [pendingAction.pcName], shutDownPc))
      notify(`${pendingAction.pcName} is shutting down.`, 'power')
    } else {
      setPcs((current) => updateActionablePcs(current, pendingAction.pcNames, shutDownPc))
      setSelectedNames([])
      notify(`Shutting down ${formatPcCount(pendingAction.pcNames.length)}.`, 'power')
    }
    setPendingAction(null)
    setDetailPcName(null)
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
          {isDisconnected && (
            <Button variant="secondary" onClick={retryConnection}>
              <Icon name="refresh" />
              Retry now
            </Button>
          )}
        </PageHeader>

        {isDisconnected && (
          <Banner variant="danger" icon="alert" role="alert" title="Disconnected">
            The console lost its connection to the server program. Controls are turned off so no
            command is sent blindly. Reconnecting automatically…
          </Banner>
        )}

        <PcBulkToolbar
          selectionState={isDisconnected ? 'none' : getSelectionState(visibleNames, selectedNames)}
          selectedCount={isDisconnected ? 0 : actionableSelectedNames.length}
          messageRecipientCount={isDisconnected ? 0 : messageRecipientNames.length}
          restrictionTargetCount={isDisconnected ? 0 : selectedNames.length}
          hasVisiblePcs={visiblePcs.length > 0}
          isDisabled={isDisconnected}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSelectAll={() => setSelectedNames(toggleSelectAll(visibleNames, selectedNames))}
          onUnlockAll={unlockAll}
          onLockAll={lockAll}
          onShutdownSelected={requestShutdownSelected}
          onSendMessage={() => setIsSendingMessage(true)}
          onOpenRestrictions={() => setIsEditingRestrictions(true)}
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
          onLock={() => lockDetailPc(detailPc.name)}
          onUnlock={() => unlockDetailPc(detailPc.name)}
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
          onTimeOut={() => timeOut(addTimePc.name)}
          onCancel={() => setAddTimePcName(null)}
        />
      )}

      {!isDisconnected && isEditingRestrictions && (
        <RestrictionsDialog
          targetPcs={pcs.filter((pc) => selectedNames.includes(pc.name))}
          onApply={applyPcRestrictions}
          onCancel={() => setIsEditingRestrictions(false)}
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
