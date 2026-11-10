import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../component/layout/page-header'
import { AddTimeDialog } from '../component/pc/add-time-dialog'
import { ClientUpdateDialog } from '../component/pc/client-update-dialog'
import { LockDialog } from '../component/pc/lock-dialog'
import { PcBulkToolbar } from '../component/pc/pc-bulk-toolbar'
import { PcDetailDialog } from '../component/pc/pc-detail-dialog'
import { PcGrid } from '../component/pc/pc-grid'
import { RestrictionsDialog } from '../component/pc/restrictions-dialog'
import { PowerDialog, type PowerAction } from '../component/pc/power-dialog'
import { RemovePcDialog } from '../component/pc/remove-pc-dialog'
import { SendMessageDialog } from '../component/pc/send-message-dialog'
import { useClientUpdates } from '../component/pc/use-client-updates'
import { usePcs } from '../component/pc/use-pcs'
import { useConsoleDefaults } from '../component/settings/use-console-defaults'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Icon, type IconName } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'
import type { ApiResult } from '../lib/api'
import { isSessionExpired } from '../lib/auth-state'
import { getLockActionPcIds, type LockAction } from '../lib/pc-lock-action'
import { describeInternetResult } from '../lib/internet'
import {
  canEditPcTime,
  countOnlinePcs,
  countPcsHiddenFromView,
  describeBulkCancelResult,
  describeBulkLockResult,
  describeBulkPowerResult,
  describeCancelPowerRequest,
  describeSinglePowerResult,
  describeTimeEdit,
  filterPcs,
  formatLastUpdate,
  getLockToggleTarget,
  getPcIdsToCancelPower,
  getPcIdsToLock,
  getPcIdsToReboot,
  getPcIdsToShutDown,
  getPcIdsToUnlock,
  getMessageTargets,
  getPcNamesToReboot,
  getPcNamesToShutDown,
  getSelectionState,
  getScreenHref,
  getServerPcPowerNote,
  toggleSelectAll,
  toggleSelectedName,
  toPcTimeCommand,
  type MessageTargets,
} from '../lib/pcs'
import type {
  PcLockAction,
  PcTimeCommand,
  PowerCommand,
  RegisteredPc,
  ViewMode,
} from '../types'

const NO_PCS_MESSAGE =
  'No PCs registered yet. Install the client on a PC and register it to see it here.'
const POWER_NOTICE_ICON: Record<PowerCommand, IconName> = { shutdown: 'power', reboot: 'refresh' }

function getSelectedPowerPcIds(action: PowerAction | null): number[] {
  return action && 'pcIds' in action ? action.pcIds : []
}

export function DashboardPage() {
  const notify = useNotify()
  const navigate = useNavigate()
  const {
    pcs,
    loadState,
    isDisconnected,
    lastUpdatedAt,
    removingPcIds,
    lockingPcIds,
    timeEditingPcIds,
    powerPendingPcIds,
    isBulkCommandBusy,
    retry,
    removePc,
    lockPc,
    unlockPc,
    editPcTime,
    lockPcs,
    unlockPcs,
    shutDownPc,
    shutDownPcs,
    rebootPc,
    rebootPcs,
    cancelPcPower,
    cancelPcsPower,
    setPcsInternetBlocked,
    queueClientUpdates,
    cancelClientUpdates,
    sendMessage,
  } = usePcs()
  const clientUpdates = useClientUpdates({
    queuePcIds: queueClientUpdates,
    cancelPcIds: cancelClientUpdates,
  })
  const [detailPcName, setDetailPcName] = useState<string | null>(null)
  // Null follows the saved default until the admin picks a mode in the detail dialog.
  const [detailViewMode, setDetailViewMode] = useState<ViewMode | null>(null)
  const [timeEditPcName, setTimeEditPcName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pcToRemove, setPcToRemove] = useState<RegisteredPc | null>(null)
  const [lockAction, setLockAction] = useState<LockAction | null>(null)
  const [restrictionTargetPcs, setRestrictionTargetPcs] = useState<RegisteredPc[] | null>(null)
  const [powerAction, setPowerAction] = useState<PowerAction | null>(null)
  const [messageTargets, setMessageTargets] = useState<MessageTargets | null>(null)
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const { defaults: consoleDefaults } = useConsoleDefaults()
  const detailScreenMode = detailViewMode ?? consoleDefaults.defaultViewMode

  const isLoaded = loadState.status === 'loaded'
  const detailPc = pcs.find((pc) => pc.name === detailPcName)
  // The PC is found by name, so each poll shows its latest state.
  const timeEditPc = pcs.find((pc) => pc.name === timeEditPcName)
  const editablePc = timeEditPc && canEditPcTime(timeEditPc) ? timeEditPc : undefined
  // Closes the time dialog once its PC stops qualifying, so it cannot reopen by itself later.
  if (timeEditPcName !== null && !editablePc) setTimeEditPcName(null)
  const visiblePcs = filterPcs(pcs, searchQuery)
  const visiblePcNames = visiblePcs.map((pc) => pc.name)
  // Names of PCs that were removed drop out here, so the selection never points at a missing PC.
  const selectedPcNames = selectedNames.filter((name) => pcs.some((pc) => pc.name === name))
  const lockPcIds = getPcIdsToLock(pcs, selectedPcNames)
  const unlockPcIds = getPcIdsToUnlock(pcs, selectedPcNames)
  const shutDownPcIds = getPcIdsToShutDown(pcs, selectedPcNames)
  const shutDownPcNames = getPcNamesToShutDown(pcs, selectedPcNames)
  const rebootPcIds = getPcIdsToReboot(pcs, selectedPcNames)
  const rebootPcNames = getPcNamesToReboot(pcs, selectedPcNames)
  const cancelPowerPcIds = getPcIdsToCancelPower(pcs, selectedPcNames)
  const selectedMessageTargets = getMessageTargets(pcs, selectedPcNames)
  const selectedPcs = pcs.filter((pc) => selectedPcNames.includes(pc.name))
  // The server PC keeps its internet, so it is not counted for Restrictions.
  const restrictionTargetCount = selectedPcs.filter((pc) => !pc.isServerPc).length
  const clientUpdatePcIds = selectedPcs.map((pc) => pc.id)
  const cancelClientUpdatePcIds = selectedPcs.filter((pc) => Boolean(pc.clientUpdate)).map((pc) => pc.id)
  const selectedServerPc = selectedPcs.find((pc) => pc.isServerPc)
  const isLockBusy =
    lockAction && 'pc' in lockAction
      ? lockingPcIds.includes(lockAction.pc.id)
      : isBulkCommandBusy
  const isPowerBusy =
    powerAction && 'pc' in powerAction
      ? powerPendingPcIds.includes(powerAction.pc.id)
      : isBulkCommandBusy

  function closeDetail() {
    setDetailPcName(null)
    setDetailViewMode(null)
  }

  function toggleSelectedPc(pcName: string) {
    setSelectedNames((current) => toggleSelectedName(current, pcName))
  }

  function isTimeEditDisabled(pcName: string): boolean {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    return isDisconnected || (pc !== undefined && timeEditingPcIds.includes(pc.id))
  }

  function toggleSelectAllVisiblePcs() {
    setSelectedNames(toggleSelectAll(visiblePcNames, selectedPcNames))
  }

  function isRemoveDisabled(pcName: string): boolean {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    return isDisconnected || (pc !== undefined && removingPcIds.includes(pc.id))
  }

  function isLockDisabled(pcName: string): boolean {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    return isDisconnected || (pc !== undefined && lockingPcIds.includes(pc.id))
  }

  function isPowerDisabled(pcName: string): boolean {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    return isDisconnected || (pc !== undefined && powerPendingPcIds.includes(pc.id))
  }

  // Null means the PC is offline or the same command is still running, so nothing is reported.
  function notifySinglePcLock(
    pc: RegisteredPc,
    action: PcLockAction,
    result: ApiResult<undefined> | null,
  ) {
    if (!result) return
    if (result.success) notify(`${pc.name} ${action === 'lock' ? 'locked' : 'unlocked'}.`, action)
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  async function unlockOnePc(pc: RegisteredPc) {
    notifySinglePcLock(pc, 'unlock', await unlockPc(pc))
  }

  // Locking asks for an optional message first. Unlocking takes effect at once.
  function toggleLockOfPcNamed(pcName: string) {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    if (!pc) return
    if (getLockToggleTarget(pc) === 'lock') setLockAction({ kind: 'lock', pc })
    else void unlockOnePc(pc)
  }

  function openPowerOfPcNamed(kind: PowerCommand, pcName: string) {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    if (pc) setPowerAction({ kind, pc })
  }

  // The message is only used by lock. Null means the PC shows the default from Settings.
  async function confirmLock(action: LockAction, message: string | null) {
    if ('pc' in action) {
      const result = await lockPc(action.pc, message)
      // Null means the PC is offline or a lock for it is still running, so the dialog stays open.
      if (!result) return
      setLockAction(null)
      notifySinglePcLock(action.pc, 'lock', result)
      return
    }
    const result =
      action.kind === 'lock'
        ? await lockPcs(action.pcIds, message)
        : await unlockPcs(action.pcIds)
    // Null means the same command is still running, which closes the dialog when it ends.
    if (!result) return
    setLockAction(null)
    if (result.success) {
      notify(describeBulkLockResult(action.kind, result.data.affected), action.kind)
    } else if (!isSessionExpired(result)) {
      notify(result.error, 'alert')
    }
  }

  // Null means the PC cannot take the command or the same command is still running.
  async function runOnePcPower(kind: PowerCommand, pc: RegisteredPc) {
    const result = kind === 'shutdown' ? await shutDownPc(pc) : await rebootPc(pc)
    if (!result) return
    setPowerAction(null)
    if (result.success) notify(describeSinglePowerResult(pc.name, kind), POWER_NOTICE_ICON[kind])
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  async function runSelectedPcsPower(kind: PowerCommand, pcIds: number[]) {
    const result = kind === 'shutdown' ? await shutDownPcs(pcIds) : await rebootPcs(pcIds)
    // Null means the same bulk command is still running, which closes the dialog when it ends.
    if (!result) return
    setPowerAction(null)
    if (result.success) {
      notify(describeBulkPowerResult(kind, result.data.affected), POWER_NOTICE_ICON[kind])
    } else if (!isSessionExpired(result)) {
      notify(result.error, 'alert')
    }
  }

  // Cancels act at once, with no dialog. Null means the PC is no longer in a countdown or the same cancel is running.
  async function cancelOnePcPower(pc: RegisteredPc) {
    const result = await cancelPcPower(pc)
    if (!result) return
    if (result.success) notify(describeCancelPowerRequest(pc.name), 'x')
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  // Null means the same bulk command is still running.
  async function cancelSelectedPcsPower(pcIds: number[]) {
    const result = await cancelPcsPower(pcIds)
    if (!result) return
    if (result.success) notify(describeBulkCancelResult(result.data.affected), 'x')
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  function cancelPowerOfPcNamed(pcName: string) {
    const pc = pcs.find((candidate) => candidate.name === pcName)
    if (pc) void cancelOnePcPower(pc)
  }

  // Null means the same bulk command is still running, so the dialog stays open and can try again.
  // A failed change keeps the dialog open with the error, and a successful one closes it.
  async function applyRestrictionsInternet(pcIds: number[], blocked: boolean) {
    const result = await setPcsInternetBlocked(pcIds, blocked)
    if (result?.success) {
      setRestrictionTargetPcs(null)
      notify(describeInternetResult(blocked, result.data), 'plug')
    }
    return result
  }

  async function confirmPowerAction(action: PowerAction) {
    if ('pc' in action) {
      await runOnePcPower(action.kind, action.pc)
    } else {
      const kind = action.kind === 'reboot-selected' ? 'reboot' : 'shutdown'
      await runSelectedPcsPower(kind, action.pcIds)
    }
  }

  async function submitTimeEdit(pc: RegisteredPc, command: PcTimeCommand) {
    const result = await editPcTime(pc, command)
    // Null means the PC has no running session or the same edit is still running.
    if (!result) return
    if (result.success) {
      setTimeEditPcName(null)
      notify(describeTimeEdit(pc.name, command), 'clock')
    } else if (!isSessionExpired(result)) {
      notify(result.error, 'alert')
    }
  }

  async function removeConfirmedPc(pc: RegisteredPc) {
    setPcToRemove(null)
    const result = await removePc(pc)
    if (result.success) notify(`${pc.name} removed.`, 'x')
    else if (!isSessionExpired(result)) notify(result.error, 'alert')
  }

  return (
    <>
      <div className="flex flex-col gap-6 md:sticky md:top-0 md:z-10 md:-mt-6 md:bg-surface-100 md:pt-6">
        <PageHeader
          title="Dashboard"
          meta={
            isLoaded && (
              <span className="text-ink-muted">
                {isDisconnected && lastUpdatedAt
                  ? `Last update ${formatLastUpdate(lastUpdatedAt)}`
                  : `${countOnlinePcs(pcs)} of ${pcs.length} PCs online`}
              </span>
            )
          }
        >
          {isDisconnected && (
            <Button variant="secondary" onClick={retry}>
              <Icon name="refresh" />
              Retry now
            </Button>
          )}
        </PageHeader>

        {isDisconnected && (
          <Banner variant="danger" icon="alert" role="alert" title="Disconnected">
            The console lost its connection to the server. The statuses below are the last known
            values. Reconnecting automatically…
          </Banner>
        )}

        {isLoaded && pcs.length > 0 && (
          <PcBulkToolbar
            hasVisiblePcs={visiblePcs.length > 0}
            lockSelectedCount={lockPcIds.length}
            unlockSelectedCount={unlockPcIds.length}
            isBulkLockDisabled={isDisconnected || isBulkCommandBusy}
            shutdownSelectedCount={shutDownPcIds.length}
            rebootSelectedCount={rebootPcIds.length}
            cancelSelectedCount={cancelPowerPcIds.length}
            messageRecipientCount={selectedMessageTargets.recipients.length}
            isSendMessageDisabled={isDisconnected}
            onSendMessage={() => setMessageTargets(selectedMessageTargets)}
            isBulkPowerDisabled={isDisconnected || isBulkCommandBusy}
            restrictionTargetCount={restrictionTargetCount}
            isRestrictionsDisabled={isDisconnected || isBulkCommandBusy}
            onOpenRestrictions={() => setRestrictionTargetPcs(selectedPcs)}
            clientUpdateCount={clientUpdatePcIds.length}
            isClientUpdateDisabled={
              isDisconnected || isBulkCommandBusy || clientUpdates.release === null
            }
            onClientUpdate={() =>
              void clientUpdates.openUpdate(clientUpdatePcIds, selectedServerPc !== undefined)
            }
            cancelClientUpdateCount={cancelClientUpdatePcIds.length}
            isCancelClientUpdateDisabled={isDisconnected || isBulkCommandBusy}
            onCancelClientUpdate={() => void clientUpdates.cancelUpdates(cancelClientUpdatePcIds)}
            selectionState={getSelectionState(visiblePcNames, selectedPcNames)}
            selectedCount={selectedPcNames.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleSelectAll={toggleSelectAllVisiblePcs}
            serverPcNote={selectedServerPc && getServerPcPowerNote(selectedServerPc.name)}
            onUnlockSelected={() => setLockAction({ kind: 'unlock', pcIds: unlockPcIds })}
            onLockSelected={() => setLockAction({ kind: 'lock', pcIds: lockPcIds })}
            onRebootSelected={() =>
              setPowerAction({
                kind: 'reboot-selected',
                pcIds: rebootPcIds,
                pcNames: rebootPcNames,
              })
            }
            onShutdownSelected={() =>
              setPowerAction({
                kind: 'shutdown-selected',
                pcIds: shutDownPcIds,
                pcNames: shutDownPcNames,
              })
            }
            onCancelSelected={() => void cancelSelectedPcsPower(cancelPowerPcIds)}
          />
        )}
      </div>

      {loadState.status === 'loading' && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading PCs...
        </p>
      )}

      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner
            variant="danger"
            icon="alert"
            title="Can't load PCs"
            role="alert"
            className="w-full"
          >
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      {isLoaded && pcs.length === 0 && (
        <p className="m-0 rounded-lg border border-border bg-surface-200 p-6 text-center text-ink-muted">
          {NO_PCS_MESSAGE}
        </p>
      )}

      {isLoaded && pcs.length > 0 && (
        <PcGrid
          pcs={visiblePcs}
          selectedNames={selectedPcNames}
          viewMode={consoleDefaults.defaultViewMode}
          emptyMessage={`No PCs match "${searchQuery}".`}
          isLockDisabled={isLockDisabled}
          isTimeEditDisabled={isTimeEditDisabled}
          isRemoveDisabled={isRemoveDisabled}
          isPowerDisabled={isPowerDisabled}
          onToggleSelect={toggleSelectedPc}
          onOpenDetail={setDetailPcName}
          onViewScreen={(href) => navigate(href)}
          onToggleLock={toggleLockOfPcNamed}
          onAddTime={setTimeEditPcName}
          onReboot={(pcName) => openPowerOfPcNamed('reboot', pcName)}
          onShutdown={(pcName) => openPowerOfPcNamed('shutdown', pcName)}
          onCancelPower={cancelPowerOfPcNamed}
          onRemove={(pcName) => setPcToRemove(pcs.find((pc) => pc.name === pcName) ?? null)}
        />
      )}

      {detailPc && (
        <PcDetailDialog
          pc={detailPc}
          viewMode={detailScreenMode}
          onViewModeChange={setDetailViewMode}
          screenHref={getScreenHref(detailPc.name, detailScreenMode)}
          isLockDisabled={isLockDisabled(detailPc.name)}
          isTimeEditDisabled={isTimeEditDisabled(detailPc.name)}
          isPowerDisabled={isPowerDisabled(detailPc.name)}
          onClose={closeDetail}
          onLock={() => setLockAction({ kind: 'lock', pc: detailPc })}
          onUnlock={() => void unlockOnePc(detailPc)}
          onReboot={() => setPowerAction({ kind: 'reboot', pc: detailPc })}
          onShutdown={() => setPowerAction({ kind: 'shutdown', pc: detailPc })}
          onCancelPower={() => void cancelOnePcPower(detailPc)}
          onAddTime={() => setTimeEditPcName(detailPc.name)}
          isSendMessageDisabled={isDisconnected}
          onSendMessage={() =>
            setMessageTargets(getMessageTargets([detailPc], [detailPc.name]))
          }
        />
      )}

      {editablePc && (
        <AddTimeDialog
          pc={editablePc}
          isBusy={timeEditingPcIds.includes(editablePc.id)}
          onConfirm={(choice) => void submitTimeEdit(editablePc, toPcTimeCommand(choice))}
          onTimeOut={() => void submitTimeEdit(editablePc, { action: 'time-out' })}
          onCancel={() => setTimeEditPcName(null)}
        />
      )}

      {lockAction && (
        <LockDialog
          action={lockAction}
          defaultMessage={consoleDefaults.lockMessage}
          hiddenPcCount={countPcsHiddenFromView(getLockActionPcIds(lockAction), pcs, visiblePcNames)}
          isBusy={isLockBusy}
          onConfirm={(message) => void confirmLock(lockAction, message)}
          onCancel={() => setLockAction(null)}
        />
      )}

      {restrictionTargetPcs && (
        <RestrictionsDialog
          targetPcs={restrictionTargetPcs}
          onApplyInternet={applyRestrictionsInternet}
          onClose={() => setRestrictionTargetPcs(null)}
        />
      )}

      <ClientUpdateDialog
        target={clientUpdates.updateTarget}
        errorMessage={clientUpdates.updateError}
        isBusy={isBulkCommandBusy}
        onInstallNowChange={clientUpdates.setInstallNow}
        onConfirm={() =>
          clientUpdates.updateTarget && void clientUpdates.confirmUpdate(clientUpdates.updateTarget)
        }
        onCancel={clientUpdates.closeUpdate}
      />

      <PowerDialog
        action={powerAction}
        pcs={pcs}
        countdownSeconds={consoleDefaults.powerCountdownSeconds}
        hiddenPcCount={countPcsHiddenFromView(
          getSelectedPowerPcIds(powerAction),
          pcs,
          visiblePcNames,
        )}
        isBusy={isPowerBusy}
        onConfirm={() => powerAction && void confirmPowerAction(powerAction)}
        onCancel={() => setPowerAction(null)}
      />

      {messageTargets && (
        <SendMessageDialog
          recipients={messageTargets.recipients}
          offlineCount={messageTargets.offlineCount}
          onSend={(text) => sendMessage(messageTargets.recipients.map((pc) => pc.id), text)}
          onClose={() => setMessageTargets(null)}
        />
      )}

      <RemovePcDialog
        pc={pcToRemove}
        onConfirm={() => pcToRemove && void removeConfirmedPc(pcToRemove)}
        onCancel={() => setPcToRemove(null)}
      />
    </>
  )
}
