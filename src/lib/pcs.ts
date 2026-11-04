import type { ApprovalChoice, Pc, SelectionState, TimeUnit, ViewMode } from '../types'

const MINUTES_PER_HOUR = 60

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

function withoutSession(pc: Pc): Pc {
  return {
    ...pc,
    user: undefined,
    timeUsed: undefined,
    isOpenTime: undefined,
    minutesLeft: undefined,
  }
}

export function lockPc(pc: Pc): Pc {
  return { ...withoutSession(pc), status: 'locked' }
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

export function togglePcLock(pc: Pc): Pc {
  if (pc.status === 'in-use') return lockPc(pc)
  if (pc.status === 'locked') return unlockPc(pc)
  return pc
}

export function lockAllPcs(pcs: Pc[]): Pc[] {
  return pcs.map((pc) => (pc.status === 'in-use' ? lockPc(pc) : pc))
}

export function unlockAllPcs(pcs: Pc[]): Pc[] {
  return pcs.map((pc) => (pc.status === 'locked' ? unlockPc(pc) : pc))
}

export function updateActionablePcs(
  pcs: Pc[],
  pcNames: string[],
  transform: (pc: Pc) => Pc,
): Pc[] {
  return pcs.map((pc) => (pcNames.includes(pc.name) && isPcActionable(pc) ? transform(pc) : pc))
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
