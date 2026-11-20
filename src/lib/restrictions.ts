import { formatPcCount } from './pcs'
import type { Pc, PcRestrictions, RegisteredPc } from '../types'

// The PC settings the Restrictions dialog turns off or allows again.
export type RestrictionFlag = 'fastUserSwitchingDisabled' | 'taskManagerDisabled'

// Off on every PC, on none, or on some of them.
export type RestrictionChoice = 'disabled' | 'allowed' | 'mixed'

const RESTRICTION_NAMES: Record<RestrictionFlag, string> = {
  fastUserSwitchingDisabled: 'Fast User Switching',
  taskManagerDisabled: 'Task Manager',
}

export function getRestrictionChoice(pcs: Pc[], flag: RestrictionFlag): RestrictionChoice {
  const disabledCount = pcs.filter((pc) => pc[flag] === true).length
  if (disabledCount === 0) return 'allowed'
  return disabledCount === pcs.length ? 'disabled' : 'mixed'
}

// The PCs not in the wanted state yet, so an unchanged PC isn't sent again.
export function getPcIdsToSetRestriction(
  pcs: RegisteredPc[],
  flag: RestrictionFlag,
  disabled: boolean,
): number[] {
  return pcs.filter((pc) => (pc[flag] === true) !== disabled).map((pc) => pc.id)
}

export function describeRestrictionResult(
  flag: RestrictionFlag,
  disabled: boolean,
  affected: number,
): string {
  const name = RESTRICTION_NAMES[flag]
  if (affected === 0) return `No PCs had ${name} changed.`
  return disabled
    ? `${name} turned off for ${formatPcCount(affected)}.`
    : `${name} allowed again for ${formatPcCount(affected)}.`
}

// A new object each time, so no caller can change a shared default.
export function emptyRestrictions(): PcRestrictions {
  return { policies: [], hiddenDrives: [], disabledDrives: [] }
}

export function describeRestrictionsResult(affected: number): string {
  if (affected === 0) return 'No PCs had restrictions changed.'
  return `Restrictions updated for ${formatPcCount(affected)}.`
}

// One item of a list, such as a policy or a drive: chosen on every PC, on none, or on some of them.
export type CheckState = 'on' | 'off' | 'mixed'

export type CheckStates<T extends string> = Record<T, CheckState>

export function getCheckStates<T extends string>(
  items: readonly T[],
  lists: readonly (readonly T[])[],
): CheckStates<T> {
  const states = {} as CheckStates<T>
  for (const item of items) {
    const count = lists.filter((list) => list.includes(item)).length
    states[item] = count === 0 ? 'off' : count === lists.length ? 'on' : 'mixed'
  }
  return states
}

// The state of the items together, for a Select/Deselect All checkbox.
export function getCombinedState<T extends string>(
  states: CheckStates<T>,
  items: readonly T[],
): CheckState {
  if (items.length > 0 && items.every((item) => states[item] === 'on')) return 'on'
  if (items.every((item) => states[item] === 'off')) return 'off'
  return 'mixed'
}

export function setCheckStates<T extends string>(
  states: CheckStates<T>,
  items: readonly T[],
  state: CheckState,
): CheckStates<T> {
  const next = { ...states }
  for (const item of items) next[item] = state
  return next
}

// Only the items the administrator set to a state other than the PCs' current one. A mixed item is left as the PCs have it.
export function getCheckChanges<T extends string>(
  initial: CheckStates<T>,
  current: CheckStates<T>,
): Partial<Record<T, boolean>> {
  const changes: Partial<Record<T, boolean>> = {}
  for (const item of Object.keys(current) as T[]) {
    const state = current[item]
    if (state !== 'mixed' && state !== initial[item]) changes[item] = state === 'on'
  }
  return changes
}

// Every restriction a PC has, with Task Manager and Fast User Switch counted as one each.
export function countActiveRestrictions(pc: Pc): number {
  const restrictions = pc.restrictions ?? emptyRestrictions()
  return (
    restrictions.policies.length +
    restrictions.hiddenDrives.length +
    restrictions.disabledDrives.length +
    (pc.taskManagerDisabled ? 1 : 0) +
    (pc.fastUserSwitchingDisabled ? 1 : 0)
  )
}

export function getRestrictionSummary(pc: Pc): string {
  const count = countActiveRestrictions(pc)
  return count === 0 ? 'None' : `${count} active`
}
