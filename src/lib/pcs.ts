import type {
  ApprovalChoice,
  BulkLockKind,
  Pc,
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
    return { status: 'in-use', user, timeUsed, isOpenTime: true }
  }
  return {
    status: 'in-use',
    user,
    timeUsed,
    minutesLeft:
      session.secondsRemaining === null
        ? undefined
        : Math.ceil(Math.max(0, session.secondsRemaining) / SECONDS_PER_MINUTE),
  }
}

// An online PC with a live session is in use; online without one is waiting for a user.
export function toRegisteredPc(serverPc: ServerPc, now: Date): RegisteredPc {
  const session = serverPc.isOnline && serverPc.session ? serverPc.session : null
  return {
    id: serverPc.id,
    name: serverPc.name,
    status: serverPc.isOnline ? 'locked' : 'offline',
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
  return pc.status === 'locked' || pc.status === 'in-use'
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

export function isPcUnlockedWithoutUser(pc: Pick<Pc, 'status' | 'user'>): boolean {
  return pc.status === 'in-use' && !pc.user
}

function withoutSession(pc: Pc): Pc {
  return {
    ...pc,
    user: undefined,
    timeUsed: undefined,
    isOpenTime: undefined,
    minutesLeft: undefined,
  }
}

export function unlockPc(pc: Pc): Pc {
  return { ...pc, status: 'in-use', timeUsed: '00:00' }
}

export function shutDownPc(pc: Pc): Pc {
  return { ...withoutSession(pc), status: 'shutdown', lastSeen: 'Now' }
}

export function rebootPc(pc: Pc): Pc {
  return { ...withoutSession(pc), status: 'rebooting' }
}

export function countPcsToLock(pcs: Pc[]): number {
  return pcs.filter((pc) => pc.status === 'in-use').length
}

// A locked PC is online with no session, so it is waiting to be unlocked.
export function countPcsToUnlock(pcs: Pc[]): number {
  return pcs.filter((pc) => pc.status === 'locked').length
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

export function updateActionablePcs(
  pcs: Pc[],
  pcNames: string[],
  transform: (pc: Pc) => Pc,
): Pc[] {
  return pcs.map((pc) => (pcNames.includes(pc.name) && isPcActionable(pc) ? transform(pc) : pc))
}

export function getLogsHref(pcName: string): string {
  return `/logs?pc=${encodeURIComponent(pcName)}`
}

export function parseTimeAmount(amount: string, unit: TimeUnit): number | null {
  if (!/^\d+$/.test(amount.trim())) return null
  const minutes = Number(amount) * (unit === 'hours' ? MINUTES_PER_HOUR : 1)
  return minutes >= 1 && Number.isSafeInteger(minutes) ? minutes : null
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

export function grantPcTime(pc: Pc, choice: ApprovalChoice): Pc {
  const session = pc.status === 'locked' ? unlockPc(pc) : pc
  if (choice.mode === 'open-time') {
    return { ...session, isOpenTime: true, minutesLeft: undefined }
  }
  const currentMinutes = pc.isOpenTime ? 0 : (pc.minutesLeft ?? 0)
  return { ...session, isOpenTime: undefined, minutesLeft: currentMinutes + choice.minutes }
}

export function describeTimeGrant(pcName: string, choice: ApprovalChoice): string {
  if (choice.mode === 'open-time') return `${pcName} is now on open time.`
  return `Added ${formatMinutes(choice.minutes)} to ${pcName}.`
}

export function getScreenHref(pcName: string, viewMode: ViewMode): string {
  return `/pc/${encodeURIComponent(pcName)}/screen?mode=${viewMode}`
}
