import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../component/layout/page-header'
import { AddTimeDialog } from '../component/pc/add-time-dialog'
import { BulkTimeDialog } from '../component/pc/bulk-time-dialog'
import { ClientUpdateDialog } from '../component/pc/client-update-dialog'
import { LockDialog } from '../component/pc/lock-dialog'
import { PcBulkToolbar } from '../component/pc/pc-bulk-toolbar'
import { PcDetailDialog } from '../component/pc/pc-detail-dialog'
import { PcGrid } from '../component/pc/pc-grid'
import { RestrictionsDialog } from '../component/pc/restrictions-dialog'
import { PowerDialog, type PowerAction } from '../component/pc/power-dialog'
import { RemovePcDialog } from '../component/pc/remove-pc-dialog'
import { RenamePcDialog } from '../component/pc/rename-pc-dialog'
import { SendMessageDialog } from '../component/pc/send-message-dialog'
import { WallpaperDialog } from '../component/pc/wallpaper-dialog'
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
  describeBulkTimeResult,
  describeCancelPowerRequest,
  describeSinglePowerResult,
  describeBulkWallpaperResult,
  describeKeepAwakeResult,
  describeRename,
  describeTimeEdit,
  filterPcs,
  formatLastUpdate,
  getLockToggleTarget,
  getPcIdsToCancelPower,
  getBulkTimeTargetIds,
  getPcIdsToEditTime,
  getPcIdsToKeepAwake,
  getPcIdsToUpdateClient,
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
  toggleSelectedId,
  toPcTimeCommand,
  type MessageTargets,
} from '../lib/pcs'
import type { BulkCommandResult, RenamedPc } from '../lib/pcs-api'
import type {
  PcLockAction,
  PcTimeCommand,
  PowerCommand,
  RegisteredPc,
  ViewMode,
  WallpaperCommand,
} from '../types'

const NOT_FOUND_STATUS = 404
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
    renamePc,
    lockPc,
    unlockPc,
    editPcTime,
    editPcsTime,
    lockPcs,
    unlockPcs,
    shutDownPc,
    shutDownPcs,
    rebootPc,
    rebootPcs,
    cancelPcPower,
    cancelPcsPower,
    setPcsInternetBlocked,
    setPcsWallpaper,
    applyPcsWallpaper,
    setPcsKeepAwake,
    queueClientUpdates,
    cancelClientUpdates,
    sendMessage,
  } = usePcs()
  const clientUpdates = useClientUpdates({
    queuePcIds: queueClientUpdates,
    cancelPcIds: cancelClientUpdates,
  })
  // Dialogs and the selection are kept by id, since a rename can give another PC a tracked PC's old name.
  const [detailPcId, setDetailPcId] = useState<number | null>(null)
  // Null follows the saved default until the admin picks a mode in the detail dialog.
  const [detailViewMode, setDetailViewMode] = useState<ViewMode | null>(null)
  const [timeEditPcId, setTimeEditPcId] = useState<number | null>(null)
  // The PCs are fixed when the dialog opens, so the count shown matches what the command changes.
  const [bulkTimeEditPcs, setBulkTimeEditPcs] = useState<RegisteredPc[] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pcToRemove, setPcToRemove] = useState<RegisteredPc | null>(null)
  // Kept by id, since the name changes once the rename succeeds.
  const [renamePcId, setRenamePcId] = useState<number | null>(null)
  const [lockAction, setLockAction] = useState<LockAction | null>(null)
  const [restrictionTargetPcs, setRestrictionTargetPcs] = useState<RegisteredPc[] | null>(null)
  const [powerAction, setPowerAction] = useState<PowerAction | null>(null)
  const [messageTargets, setMessageTargets] = useState<MessageTargets | null>(null)
  const [wallpaperTargetPcs, setWallpaperTargetPcs] = useState<RegisteredPc[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { defaults: consoleDefaults } = useConsoleDefaults()
  const detailScreenMode = detailViewMode ?? consoleDefaults.defaultViewMode

  const isLoaded = loadState.status === 'loaded'
  const detailPc = pcs.find((pc) => pc.id === detailPcId)
  const pcToRename = pcs.find((pc) => pc.id === renamePcId)
  // The PC is found by id, so each poll shows its latest state.
  const timeEditPc = pcs.find((pc) => pc.id === timeEditPcId)
  const editablePc = timeEditPc && canEditPcTime(timeEditPc) ? timeEditPc : undefined
  // Closes the time dialog once its PC stops qualifying, so it cannot reopen by itself later.
  if (timeEditPcId !== null && !editablePc) setTimeEditPcId(null)
  const visiblePcs = filterPcs(pcs, searchQuery)
  const visiblePcIds = visiblePcs.map((pc) => pc.id)
  // Ids of PCs that were removed drop out here, so the selection never points at a missing PC.
  const selectedPcIds = selectedIds.filter((id) => pcs.some((pc) => pc.id === id))
  const lockPcIds = getPcIdsToLock(pcs, selectedPcIds)
  const unlockPcIds = getPcIdsToUnlock(pcs, selectedPcIds)
  const editTimePcIds = getPcIdsToEditTime(pcs, selectedPcIds)
  const shutDownPcIds = getPcIdsToShutDown(pcs, selectedPcIds)
  const shutDownPcNames = getPcNamesToShutDown(pcs, selectedPcIds)
  const rebootPcIds = getPcIdsToReboot(pcs, selectedPcIds)
  const rebootPcNames = getPcNamesToReboot(pcs, selectedPcIds)
  const cancelPowerPcIds = getPcIdsToCancelPower(pcs, selectedPcIds)
  const selectedMessageTargets = getMessageTargets(pcs, selectedPcIds)
  const selectedPcs = pcs.filter((pc) => selectedPcIds.includes(pc.id))
  const wallpaperTargetIds = wallpaperTargetPcs?.map((pc) => pc.id) ?? []
  // The server PC keeps its internet, so it is not counted for Restrictions.
  const restrictionTargetCount = selectedPcs.filter((pc) => !pc.isServerPc).length
  const clientUpdatePcIds = getPcIdsToUpdateClient(pcs, selectedPcIds)
  const cancelClientUpdatePcIds = selectedPcs.filter((pc) => Boolean(pc.clientUpdate)).map((pc) => pc.id)
  const selectedServerPc = selectedPcs.find((pc) => pc.isServerPc)
  const keepAwakeOnPcIds = getPcIdsToKeepAwake(pcs, selectedPcIds, true)
  const keepAwakeOffPcIds = getPcIdsToKeepAwake(pcs, selectedPcIds, false)
  const keepAwakeOfflineCount = keepAwakeOffPcIds.length - keepAwakeOnPcIds.length
  const isLockBusy =
    lockAction && 'pc' in lockAction
      ? lockingPcIds.includes(lockAction.pc.id)
      : isBulkCommandBusy
  const isPowerBusy =
    powerAction && 'pc' in powerAction
      ? powerPendingPcIds.includes(powerAction.pc.id)
      : isBulkCommandBusy

  function findPc(pcId: number): RegisteredPc | undefined {
    return pcs.find((candidate) => candidate.id === pcId)
  }

  function closeDetail() {
    setDetailPcId(null)
    setDetailViewMode(null)
  }

  function toggleSelectedPc(pcId: number) {
    setSelectedIds((current) => toggleSelectedId(current, pcId))
  }

  function isTimeEditDisabled(pcId: number): boolean {
    const pc = findPc(pcId)
    return isDisconnected || (pc !== undefined && timeEditingPcIds.includes(pc.id))
  }

  function toggleSelectAllVisiblePcs() {
    setSelectedIds(toggleSelectAll(visiblePcIds, selectedPcIds))
  }

  function isRemoveDisabled(pcId: number): boolean {
    const pc = findPc(pcId)
    return isDisconnected || (pc !== undefined && removingPcIds.includes(pc.id))
  }

  function isLockDisabled(pcId: number): boolean {
    const pc = findPc(pcId)
    return isDisconnected || (pc !== undefined && lockingPcIds.includes(pc.id))
  }

  function isPowerDisabled(pcId: number): boolean {
    const pc = findPc(pcId)
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
  function toggleLockOfPc(pcId: number) {
    const pc = findPc(pcId)
    if (!pc) return
    if (getLockToggleTarget(pc) === 'lock') setLockAction({ kind: 'lock', pc })
    else void unlockOnePc(pc)
  }

  function openPowerOfPc(kind: PowerCommand, pcId: number) {
    const pc = findPc(pcId)
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

  function cancelPowerOfPc(pcId: number) {
    const pc = findPc(pcId)
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

  // Null means the same bulk command is still running, so the dialog stays open until it ends.
  // A success closes the dialog and reports the result. A failure keeps it open with the error.
  async function finishWallpaperCommand(
    kind: WallpaperCommand,
    result: ApiResult<BulkCommandResult> | null,
  ) {
    if (result?.success) {
      setWallpaperTargetPcs(null)
      notify(describeBulkWallpaperResult(kind, result.data.affected), 'image')
    }
    return result
  }

  // Null means the same bulk command is still running.
  async function setSelectedPcsKeepAwake(keepAwake: boolean) {
    const pcIds = keepAwake ? keepAwakeOnPcIds : keepAwakeOffPcIds
    const result = await setPcsKeepAwake(pcIds, keepAwake)
    if (!result) return
    if (result.success) {
      notify(describeKeepAwakeResult(keepAwake, result.data.affected, keepAwakeOfflineCount), 'eye')
    } else if (!isSessionExpired(result)) {
      notify(result.error, 'alert')
    }
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
      setTimeEditPcId(null)
      notify(describeTimeEdit(pc.name, command), 'clock')
    } else if (!isSessionExpired(result)) {
      notify(result.error, 'alert')
    }
  }

  // Null means the same bulk command is still running. A failure keeps the dialog open so it can be retried.
  async function submitBulkTimeEdit(targetPcs: RegisteredPc[], command: PcTimeCommand) {
    const targetIds = getBulkTimeTargetIds(targetPcs, pcs)
    if (targetIds.length === 0) {
      setBulkTimeEditPcs(null)
      notify(describeBulkTimeResult(command, 0), 'clock')
      return
    }

    const result = await editPcsTime(targetIds, command)
    if (!result) return
    if (result.success) {
      setBulkTimeEditPcs(null)
      notify(describeBulkTimeResult(command, result.data.affected), 'clock')
    } else if (!isSessionExpired(result)) {
      notify(result.error, 'alert')
    }
  }

  // A PC that is gone closes the dialog, since the refresh removes it from the list.
  async function renameOnePc(pc: RegisteredPc, number: number): Promise<ApiResult<RenamedPc>> {
    const result = await renamePc(pc, number)
    if (result.success) {
      setRenamePcId(null)
      notify(describeRename(result.data.name), 'check')
    } else if (result.status === NOT_FOUND_STATUS) {
      setRenamePcId(null)
      notify(result.error, 'alert')
    }
    return result
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
            wallpaperCount={selectedPcs.length}
            isWallpaperDisabled={isDisconnected || isBulkCommandBusy}
            onWallpaper={() => setWallpaperTargetPcs(selectedPcs)}
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
            keepAwakeOnCount={keepAwakeOnPcIds.length}
            keepAwakeOffCount={keepAwakeOffPcIds.length}
            keepAwakeOfflineCount={keepAwakeOfflineCount}
            isKeepAwakeDisabled={isDisconnected || isBulkCommandBusy}
            onKeepAwake={(keepAwake) => void setSelectedPcsKeepAwake(keepAwake)}
            selectionState={getSelectionState(visiblePcIds, selectedPcIds)}
            selectedCount={selectedPcIds.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onToggleSelectAll={toggleSelectAllVisiblePcs}
            serverPcNote={selectedServerPc && getServerPcPowerNote(selectedServerPc.name)}
            onUnlockSelected={() => setLockAction({ kind: 'unlock', pcIds: unlockPcIds })}
            onLockSelected={() => setLockAction({ kind: 'lock', pcIds: lockPcIds })}
            editTimeSelectedCount={editTimePcIds.length}
            isBulkTimeDisabled={isDisconnected || isBulkCommandBusy}
            onEditTimeSelected={() =>
              setBulkTimeEditPcs(pcs.filter((pc) => editTimePcIds.includes(pc.id)))
            }
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

      {isLoaded && pcs.length > 0 && lastUpdatedAt && (
        <PcGrid
          pcs={visiblePcs}
          now={lastUpdatedAt}
          selectedIds={selectedPcIds}
          viewMode={consoleDefaults.defaultViewMode}
          emptyMessage={`No PCs match "${searchQuery}".`}
          isLockDisabled={isLockDisabled}
          isTimeEditDisabled={isTimeEditDisabled}
          isRemoveDisabled={isRemoveDisabled}
          isPowerDisabled={isPowerDisabled}
          onToggleSelect={toggleSelectedPc}
          onOpenDetail={setDetailPcId}
          onViewScreen={(href) => navigate(href)}
          onToggleLock={toggleLockOfPc}
          onAddTime={setTimeEditPcId}
          onReboot={(pcId) => openPowerOfPc('reboot', pcId)}
          onShutdown={(pcId) => openPowerOfPc('shutdown', pcId)}
          onCancelPower={cancelPowerOfPc}
          onRemove={(pcId) => setPcToRemove(findPc(pcId) ?? null)}
        />
      )}

      {detailPc && (
        <PcDetailDialog
          pc={detailPc}
          viewMode={detailScreenMode}
          onViewModeChange={setDetailViewMode}
          screenHref={getScreenHref(detailPc.id, detailScreenMode)}
          isLockDisabled={isLockDisabled(detailPc.id)}
          isTimeEditDisabled={isTimeEditDisabled(detailPc.id)}
          isPowerDisabled={isPowerDisabled(detailPc.id)}
          onClose={closeDetail}
          onLock={() => setLockAction({ kind: 'lock', pc: detailPc })}
          onUnlock={() => void unlockOnePc(detailPc)}
          onReboot={() => setPowerAction({ kind: 'reboot', pc: detailPc })}
          onShutdown={() => setPowerAction({ kind: 'shutdown', pc: detailPc })}
          onCancelPower={() => void cancelOnePcPower(detailPc)}
          onAddTime={() => setTimeEditPcId(detailPc.id)}
          isSendMessageDisabled={isDisconnected}
          onSendMessage={() =>
            setMessageTargets(getMessageTargets([detailPc], [detailPc.id]))
          }
          onRename={() => setRenamePcId(detailPc.id)}
        />
      )}

      {pcToRename && (
        <RenamePcDialog
          pc={pcToRename}
          onRename={(number) => renameOnePc(pcToRename, number)}
          onClose={() => setRenamePcId(null)}
        />
      )}

      {editablePc && (
        <AddTimeDialog
          pc={editablePc}
          isBusy={timeEditingPcIds.includes(editablePc.id)}
          onConfirm={(choice) => void submitTimeEdit(editablePc, toPcTimeCommand(choice))}
          onTimeOut={() => void submitTimeEdit(editablePc, { action: 'time-out' })}
          onCancel={() => setTimeEditPcId(null)}
        />
      )}

      {bulkTimeEditPcs && (
        <BulkTimeDialog
          pcs={bulkTimeEditPcs}
          isBusy={isBulkCommandBusy}
          onConfirm={(choice) => void submitBulkTimeEdit(bulkTimeEditPcs, toPcTimeCommand(choice))}
          onTimeOut={() => void submitBulkTimeEdit(bulkTimeEditPcs, { action: 'time-out' })}
          onCancel={() => setBulkTimeEditPcs(null)}
        />
      )}

      {lockAction && (
        <LockDialog
          action={lockAction}
          defaultMessage={consoleDefaults.lockMessage}
          hiddenPcCount={countPcsHiddenFromView(getLockActionPcIds(lockAction), pcs, visiblePcIds)}
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

      {wallpaperTargetPcs && (
        <WallpaperDialog
          targetPcs={wallpaperTargetPcs}
          isBusy={isBulkCommandBusy}
          onApply={async (file) =>
            finishWallpaperCommand('set', await applyPcsWallpaper(wallpaperTargetIds, file))
          }
          onRemove={async () =>
            finishWallpaperCommand('remove', await setPcsWallpaper(wallpaperTargetIds, null))
          }
          onClose={() => setWallpaperTargetPcs(null)}
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
          visiblePcIds,
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
