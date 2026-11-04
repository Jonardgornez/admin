import type { Pc } from '../types'

export function countOnlinePcs(pcs: Pc[]): number {
  return pcs.filter((pc) => pc.status === 'locked' || pc.status === 'in-use').length
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
