import type {
  ApprovalChoice,
  BulkLockKind,
  Pc,
  PcLockAction,
  PcStatus,
  PcTimeCommand,
  PowerCommand,
  RegisteredPc,
  SelectionState,
  ServerPc,
  ServerPcSession,
  TimeUnit,
  ViewMode,
} from '../types'

const MINUTES_PER_HOUR = 60
const UNKNOWN_TIME_LABEL = 'Unknown'

function formatLastSeen(lastSeenAt: string): string {
  const date = new Date(lastSeenAt)
  if (Number.isNaN(date.getTime())) return UNKNOWN_TIME_LABEL
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const SECONDS_PER_MINUTE = 60
const MILLISECONDS_PER_MINUTE = 60_000

export function formatTimeUsed(startedAt: string, now: Date): string | undefined {
  const startedTime = new Date(startedAt).getTime()
  if (Number.isNaN(startedTime)) return undefined
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - startedTime) / MILLISECONDS_PER_MINUTE))
  const hours = Math.floor(elapsedMinutes / MINUTES_PER_HOUR)
  const minutes = elapsedMinutes % MINUTES_PER_HOUR
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function toSessionFields(session: ServerPcSession, now: Date): Partial<Pc> {
  const timeUsed = formatTimeUsed(session.startedAt, now)
  const user = session.username ?? undefined
  if (session.time.mode === 'open-time') {
    return { user, timeUsed, isOpenTime: true }
  }
  return {
    user,
    timeUsed,
    minutesLeft:
      session.secondsRemaining === null
        ? undefined
        : Math.ceil(Math.max(0, session.secondsRemaining) / SECONDS_PER_MINUTE),
  }
}

// Locked online PCs are frozen, even with a paused session. Other online PCs are in use with a
// session, or waiting for a user without one. A PC the server reports as shut down or rebooting
// keeps that status. A restart countdown keeps the online status, flagged by isRestarting.
function toPcStatus(serverPc: ServerPc): PcStatus {
  if (serverPc.shutdownState === 'shutdown') return 'shutdown'
  if (serverPc.shutdownState === 'rebooting') return 'rebooting'
  if (!serverPc.isOnline) return 'offline'
  if (serverPc.isLocked) return 'frozen'
  return serverPc.session ? 'in-use' : 'locked'
}

export function toRegisteredPc(serverPc: ServerPc, now: Date): RegisteredPc {
  const session = serverPc.isOnline && serverPc.session ? serverPc.session : null
  return {
    id: serverPc.id,
    name: serverPc.name,
    status: toPcStatus(serverPc),
    isLocked: serverPc.isLocked,
    isShuttingDown: serverPc.shutdownState === 'shutting-down',
    isRestarting: serverPc.shutdownState === 'restarting',
    isCancelling: serverPc.shutdownState === 'cancelling',
    isServerPc: serverPc.isServerPc,
    lastSeen: serverPc.isOnline ? 'Now' : formatLastSeen(serverPc.lastSeenAt),
    ipAddress: serverPc.ipAddress ?? undefined,
    ...(session && toSessionFields(session, now)),
  }
}

export function comparePcNames(first: string, second: string): number {
  return first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' })
}

export function toSortedRegisteredPcs(serverPcs: ServerPc[], now: Date): RegisteredPc[] {
  return serverPcs
    .map((serverPc) => toRegisteredPc(serverPc, now))
    .sort((first, second) => comparePcNames(first.name, second.name))
}

export function formatLastUpdate(updatedAt: Date): string {
  return updatedAt.toLocaleTimeString(undefined, { timeStyle: 'medium' })
}

export function isPcOnline(pc: Pc): boolean {
  return pc.status === 'locked' || pc.status === 'frozen' || pc.status === 'in-use'
}

export function countOnlinePcs(pcs: Pc[]): number {
  return pcs.filter(isPcOnline).length
}

export function getMessageRecipients(pcs: Pc[], selectedNames: string[]): string[] {
  return pcs
    .filter((pc) => isPcOnline(pc) && selectedNames.includes(pc.name))
    .map((pc) => pc.name)
}

export function getSelectionState(visibleNames: string[], selectedNames: string[]): SelectionState {
  const selectedVisibleCount = visibleNames.filter((name) => selectedNames.includes(name)).length
  if (selectedVisibleCount === 0) return 'none'
  return selectedVisibleCount === visibleNames.length ? 'all' : 'some'
}

export function toggleSelectAll(visibleNames: string[], selectedNames: string[]): string[] {
  if (getSelectionState(visibleNames, selectedNames) === 'all') {
    return selectedNames.filter((name) => !visibleNames.includes(name))
  }
  return [...new Set([...selectedNames, ...visibleNames])]
}

export function toggleSelectedName(selectedNames: string[], pcName: string): string[] {
  return selectedNames.includes(pcName)
    ? selectedNames.filter((name) => name !== pcName)
    : [...selectedNames, pcName]
}

export function filterPcs(pcs: Pc[], query: string): Pc[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return pcs
  return pcs.filter(
    (pc) =>
      pc.name.toLowerCase().includes(needle) ||
      (pc.user?.toLowerCase().includes(needle) ?? false),
  )
}

export function isPcOff(pc: Pc): boolean {
  return pc.status === 'offline' || pc.status === 'shutdown'
}

export function isPcActionable(pc: Pc): boolean {
  return !isPcOff(pc) && pc.status !== 'rebooting'
}

export function canTimeOutPc(pc: Pc): boolean {
  return pc.status === 'in-use'
}

// A frozen PC keeps its session, so its time can be edited while it is locked.
export function canEditPcTime(pc: Pc): boolean {
  return pc.status === 'in-use' || (pc.status === 'frozen' && pc.timeUsed !== undefined)
}

export function isPcUnlockedWithoutUser(pc: Pick<Pc, 'status' | 'user'>): boolean {
  return pc.status === 'in-use' && !pc.user
}

export function canLockPc(pc: Pc): boolean {
  return pc.status === 'in-use' || pc.status === 'locked'
}

export function canUnlockPc(pc: Pc): boolean {
  return pc.status === 'frozen' || pc.status === 'locked'
}

export function countPcsHiddenFromView(
  pcIds: number[],
  pcs: RegisteredPc[],
  visibleNames: string[],
): number {
  return pcs.filter((pc) => pcIds.includes(pc.id) && !visibleNames.includes(pc.name)).length
}

export function getPcIdsToLock(pcs: RegisteredPc[], selectedNames: string[]): number[] {
  return pcs.filter((pc) => selectedNames.includes(pc.name) && canLockPc(pc)).map((pc) => pc.id)
}

export function getPcIdsToUnlock(pcs: RegisteredPc[], selectedNames: string[]): number[] {
  return pcs.filter((pc) => selectedNames.includes(pc.name) && canUnlockPc(pc)).map((pc) => pc.id)
}

export const SERVER_PC_SHUT_DOWN_TITLE = 'This PC runs the server. Shut it down by hand.'
export const SERVER_PC_REBOOT_TITLE = 'This PC runs the server. Restart it by hand.'

// The server PC is left out, because a shutdown or restart would stop the server itself.
// A PC in either countdown takes neither command until the countdown ends or is cancelled.
function canTakePowerCommand(pc: Pc): boolean {
  return (
    isPcOnline(pc) && !pc.isServerPc && !pc.isShuttingDown && !pc.isRestarting && !pc.isCancelling
  )
}

export function canShutDownPc(pc: Pc): boolean {
  return canTakePowerCommand(pc)
}

export function canRebootPc(pc: Pc): boolean {
  return canTakePowerCommand(pc)
}

function getSelectedPcs(
  pcs: RegisteredPc[],
  selectedNames: string[],
  canRun: (pc: Pc) => boolean,
): RegisteredPc[] {
  return pcs.filter((pc) => selectedNames.includes(pc.name) && canRun(pc))
}

export function getPcIdsToShutDown(pcs: RegisteredPc[], selectedNames: string[]): number[] {
  return getSelectedPcs(pcs, selectedNames, canShutDownPc).map((pc) => pc.id)
}

export function getPcNamesToShutDown(pcs: RegisteredPc[], selectedNames: string[]): string[] {
  return getSelectedPcs(pcs, selectedNames, canShutDownPc).map((pc) => pc.name)
}

export function getPcIdsToReboot(pcs: RegisteredPc[], selectedNames: string[]): number[] {
  return getSelectedPcs(pcs, selectedNames, canRebootPc).map((pc) => pc.id)
}

export function getPcNamesToReboot(pcs: RegisteredPc[], selectedNames: string[]): string[] {
  return getSelectedPcs(pcs, selectedNames, canRebootPc).map((pc) => pc.name)
}

export function getServerPcPowerNote(pcName: string): string {
  return `${pcName} runs the server and won't be shut down or restarted.`
}

// The card button does the opposite of the PC's lock state.
export function getLockToggleTarget(pc: Pc): PcLockAction {
  return pc.isLocked || canUnlockPc(pc) ? 'unlock' : 'lock'
}

export function formatPcCount(count: number): string {
  return `${count} ${count === 1 ? 'PC' : 'PCs'}`
}

export function describeBulkLockResult(kind: BulkLockKind, affected: number): string {
  if (affected === 0) return kind === 'lock' ? 'No PCs needed locking.' : 'No PCs needed unlocking.'
  return kind === 'lock'
    ? `Locked ${formatPcCount(affected)}.`
    : `Unlocked ${formatPcCount(affected)}.`
}

export function describeBulkPowerResult(kind: PowerCommand, affected: number): string {
  if (affected === 0) {
    return kind === 'shutdown' ? 'No PCs could be shut down.' : 'No PCs could be restarted.'
  }
  return kind === 'shutdown'
    ? `Shutting down ${formatPcCount(affected)}.`
    : `Restarting ${formatPcCount(affected)}.`
}

export function describeSinglePowerResult(pcName: string, kind: PowerCommand): string {
  return kind === 'shutdown' ? `${pcName} is shutting down.` : `${pcName} is restarting.`
}

export function getLogsHref(pcName: string): string {
  return `/logs?pc=${encodeURIComponent(pcName)}`
}

export function parseTimeAmount(amount: string, unit: TimeUnit): number | null {
  if (!/^\d+$/.test(amount.trim())) return null
  const minutes = Number(amount) * (unit === 'hours' ? MINUTES_PER_HOUR : 1)
  return minutes >= 1 && Number.isSafeInteger(minutes) ? minutes : null
}

const MAX_TIME_ENTRY_MINUTES = 24 * MINUTES_PER_HOUR

// Only a single entry is checked here. The server decides the final limit of a session.
export function getTimeAmountError(amount: string, unit: TimeUnit): string | undefined {
  const minutes = parseTimeAmount(amount, unit)
  if (minutes === null) return 'Enter a whole number of 1 or more.'
  if (minutes > MAX_TIME_ENTRY_MINUTES) return 'Enter 24 hours or less.'
  return undefined
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR)
  const minutes = totalMinutes % MINUTES_PER_HOUR
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

export function getTimeLeftLabel(pc: Pc): string | undefined {
  if (pc.isOpenTime) return 'Open time'
  return pc.minutesLeft === undefined ? undefined : formatMinutes(pc.minutesLeft)
}

export function describeTimeGrant(pcName: string, choice: ApprovalChoice): string {
  if (choice.mode === 'open-time') return `${pcName} is now on open time.`
  return `Added ${formatMinutes(choice.minutes)} to ${pcName}.`
}

export function toPcTimeCommand(choice: ApprovalChoice): PcTimeCommand {
  return choice.mode === 'open-time'
    ? { action: 'open-time' }
    : { action: 'add-time', minutes: choice.minutes }
}

export function describeTimeEdit(pcName: string, command: PcTimeCommand): string {
  if (command.action === 'time-out') return `${pcName} timed out.`
  if (command.action === 'open-time') return describeTimeGrant(pcName, { mode: 'open-time' })
  return describeTimeGrant(pcName, { mode: 'time-limit', minutes: command.minutes })
}

// Off PCs have no screen to show, so their View screen actions stay disabled.
export function canViewPcScreen(pc: Pc): boolean {
  return !isPcOff(pc)
}

export function getScreenHref(pcName: string, viewMode: ViewMode): string {
  return `/pc/${encodeURIComponent(pcName)}/screen?mode=${viewMode}`
}
