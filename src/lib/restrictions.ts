import { formatPcCount } from './pcs'
import type { Pc, PcRestrictions, RegisteredPc } from '../types'

// Hidden on every PC, on none, or on some of them.
export type FastUserSwitchingChoice = 'disabled' | 'allowed' | 'mixed'

export function getFastUserSwitchingChoice(pcs: Pc[]): FastUserSwitchingChoice {
  const disabledCount = pcs.filter((pc) => pc.fastUserSwitchingDisabled === true).length
  if (disabledCount === 0) return 'allowed'
  return disabledCount === pcs.length ? 'disabled' : 'mixed'
}

// The PCs not in the wanted state yet, so an unchanged PC isn't sent again.
export function getPcIdsToSetFastUserSwitching(pcs: RegisteredPc[], disabled: boolean): number[] {
  return pcs.filter((pc) => (pc.fastUserSwitchingDisabled === true) !== disabled).map((pc) => pc.id)
}

export function describeFastUserSwitchingResult(disabled: boolean, affected: number): string {
  if (affected === 0) return 'No PCs had Fast User Switching changed.'
  return disabled
    ? `Fast User Switching turned off for ${formatPcCount(affected)}.`
    : `Fast User Switching allowed again for ${formatPcCount(affected)}.`
}

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
