import type { Pc, ViewMode } from '../types'

export function isPcOnline(pc: Pc): boolean {
  return pc.status === 'locked' || pc.status === 'in-use'
}

export function countOnlinePcs(pcs: Pc[]): number {
  return pcs.filter(isPcOnline).length
}

export function getMessageRecipients(pcs: Pc[], selectedNames: string[]): string[] {
  const onlineNames = pcs.filter(isPcOnline).map((pc) => pc.name)
  const selectedOnlineNames = onlineNames.filter((name) => selectedNames.includes(name))
  return selectedOnlineNames.length > 0 ? selectedOnlineNames : onlineNames
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
  return { ...pc, user: undefined, timeUsed: undefined, isOpenTime: undefined }
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

export function getScreenHref(pcName: string, viewMode: ViewMode): string {
  return `/pc/${encodeURIComponent(pcName)}/screen?mode=${viewMode}`
}
