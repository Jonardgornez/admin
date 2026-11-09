import type { Pc, PcRestrictions } from '../types'

export const EMPTY_RESTRICTIONS: PcRestrictions = {
  policies: [],
  hiddenDrives: [],
  disabledDrives: [],
}

function intersect<T>(lists: T[][]): T[] {
  if (lists.length === 0) return []
  return lists[0].filter((value) => lists.every((list) => list.includes(value)))
}

export function getCommonRestrictions(pcs: Pc[]): PcRestrictions {
  const all = pcs.map((pc) => pc.restrictions ?? EMPTY_RESTRICTIONS)
  return {
    policies: intersect(all.map((restrictions) => restrictions.policies)),
    hiddenDrives: intersect(all.map((restrictions) => restrictions.hiddenDrives)),
    disabledDrives: intersect(all.map((restrictions) => restrictions.disabledDrives)),
  }
}

export function countActiveRestrictions(restrictions?: PcRestrictions): number {
  if (!restrictions) return 0
  return (
    restrictions.policies.length +
    restrictions.hiddenDrives.length +
    restrictions.disabledDrives.length
  )
}

export function getRestrictionSummary(restrictions?: PcRestrictions): string {
  const count = countActiveRestrictions(restrictions)
  return count === 0 ? 'None' : `${count} active`
}

export function toggleListValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function toggleAllValues<T>(allValues: T[], selectedValues: T[]): T[] {
  const isEverythingSelected = allValues.every((value) => selectedValues.includes(value))
  return isEverythingSelected ? [] : [...allValues]
}
