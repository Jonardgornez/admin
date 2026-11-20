import { describe, expect, it } from 'vitest'
import type { Pc, PcRestrictions, RegisteredPc } from '../types'
import {
  countActiveRestrictions,
  describeRestrictionResult,
  describeRestrictionsResult,
  emptyRestrictions,
  getCheckChanges,
  getCheckStates,
  getCombinedState,
  getPcIdsToSetRestriction,
  getRestrictionChoice,
  getRestrictionSummary,
  setCheckStates,
} from './restrictions'

function makePc(name: string, overrides: Partial<Pc> = {}): Pc {
  return { name, status: 'locked', lastSeen: 'Now', ...overrides }
}

const onePolicy: PcRestrictions = {
  policies: ['registry-editor'],
  hiddenDrives: [],
  disabledDrives: [],
}

describe('restriction flag helpers', () => {
  const pc = (id: number, overrides: Partial<RegisteredPc> = {}): RegisteredPc => ({
    id,
    name: `PC-${id}`,
    status: 'locked',
    lastSeen: 'Now',
    ...overrides,
  })
  const switching = (id: number, fastUserSwitchingDisabled?: boolean) =>
    pc(id, { fastUserSwitchingDisabled })

  it('reads the choice as disabled, allowed or mixed', () => {
    const flag = 'fastUserSwitchingDisabled'
    expect(getRestrictionChoice([switching(1, true), switching(2, true)], flag)).toBe('disabled')
    expect(getRestrictionChoice([switching(1), switching(2, false)], flag)).toBe('allowed')
    expect(getRestrictionChoice([switching(1, true), switching(2)], flag)).toBe('mixed')
    expect(getRestrictionChoice([], flag)).toBe('allowed')
  })

  it('reads each flag on its own', () => {
    const pcs = [pc(1, { taskManagerDisabled: true }), pc(2, { taskManagerDisabled: true })]
    expect(getRestrictionChoice(pcs, 'taskManagerDisabled')).toBe('disabled')
    expect(getRestrictionChoice(pcs, 'fastUserSwitchingDisabled')).toBe('allowed')
  })

  it('sends only the PCs not in the wanted state yet', () => {
    const pcs = [switching(1), switching(2, true), switching(3, false)]
    expect(getPcIdsToSetRestriction(pcs, 'fastUserSwitchingDisabled', true)).toEqual([1, 3])
    expect(getPcIdsToSetRestriction(pcs, 'fastUserSwitchingDisabled', false)).toEqual([2])
    expect(getPcIdsToSetRestriction(pcs, 'taskManagerDisabled', true)).toEqual([1, 2, 3])
  })

  it('describes the Fast User Switching result', () => {
    const flag = 'fastUserSwitchingDisabled'
    expect(describeRestrictionResult(flag, true, 3)).toBe('Fast User Switching turned off for 3 PCs.')
    expect(describeRestrictionResult(flag, false, 1)).toBe('Fast User Switching allowed again for 1 PC.')
    expect(describeRestrictionResult(flag, true, 0)).toBe('No PCs had Fast User Switching changed.')
  })

  it('describes the Task Manager result', () => {
    const flag = 'taskManagerDisabled'
    expect(describeRestrictionResult(flag, true, 2)).toBe('Task Manager turned off for 2 PCs.')
    expect(describeRestrictionResult(flag, false, 1)).toBe('Task Manager allowed again for 1 PC.')
    expect(describeRestrictionResult(flag, false, 0)).toBe('No PCs had Task Manager changed.')
  })
})

describe('emptyRestrictions', () => {
  it('has no policies or drives, in a new object each time', () => {
    expect(emptyRestrictions()).toEqual({ policies: [], hiddenDrives: [], disabledDrives: [] })
    expect(emptyRestrictions()).not.toBe(emptyRestrictions())
  })
})

describe('describeRestrictionsResult', () => {
  it('counts the PCs changed', () => {
    expect(describeRestrictionsResult(3)).toBe('Restrictions updated for 3 PCs.')
    expect(describeRestrictionsResult(1)).toBe('Restrictions updated for 1 PC.')
    expect(describeRestrictionsResult(0)).toBe('No PCs had restrictions changed.')
  })
})

describe('getCheckStates', () => {
  it('reads each item as on, off or mixed across the PCs', () => {
    const states = getCheckStates(['C', 'D', 'E'] as const, [['C', 'D'], ['C']])
    expect(states).toEqual({ C: 'on', D: 'mixed', E: 'off' })
  })

  it('reads every item as off for no PCs', () => {
    expect(getCheckStates(['C'] as const, [])).toEqual({ C: 'off' })
  })
})

describe('getCombinedState', () => {
  it('is on when every item is on, off when every item is off, and mixed otherwise', () => {
    expect(getCombinedState({ A: 'on', B: 'on' }, ['A', 'B'])).toBe('on')
    expect(getCombinedState({ A: 'off', B: 'off' }, ['A', 'B'])).toBe('off')
    expect(getCombinedState({ A: 'on', B: 'off' }, ['A', 'B'])).toBe('mixed')
    expect(getCombinedState({ A: 'mixed', B: 'mixed' }, ['A', 'B'])).toBe('mixed')
  })

  it('looks only at the given items', () => {
    expect(getCombinedState<'A' | 'B'>({ A: 'on', B: 'off' }, ['A'])).toBe('on')
  })
})

describe('setCheckStates', () => {
  it('sets the given items and keeps the others, without changing the input', () => {
    const states = { A: 'mixed', B: 'off', C: 'on' } as const
    expect(setCheckStates(states, ['A', 'B'], 'on')).toEqual({ A: 'on', B: 'on', C: 'on' })
    expect(states).toEqual({ A: 'mixed', B: 'off', C: 'on' })
  })
})

describe('getCheckChanges', () => {
  it('lists only the items set to a state the PCs do not have', () => {
    const initial = { A: 'off', B: 'on', C: 'mixed', D: 'mixed', E: 'off' } as const
    const current = { A: 'on', B: 'off', C: 'mixed', D: 'off', E: 'off' } as const
    expect(getCheckChanges(initial, current)).toEqual({ A: true, B: false, D: false })
  })

  it('is empty when nothing changed', () => {
    expect(getCheckChanges({ A: 'on' }, { A: 'on' })).toEqual({})
  })
})

describe('countActiveRestrictions', () => {
  it('counts policies, drives, Task Manager and Fast User Switch', () => {
    const pc = makePc('PC-01', {
      restrictions: { policies: ['registry-editor', 'run-command'], hiddenDrives: ['C'], disabledDrives: ['D', 'E'] },
      taskManagerDisabled: true,
      fastUserSwitchingDisabled: true,
    })
    expect(countActiveRestrictions(pc)).toBe(7)
  })

  it('counts nothing for a PC without restrictions', () => {
    expect(countActiveRestrictions(makePc('PC-01'))).toBe(0)
    expect(countActiveRestrictions(makePc('PC-01', { restrictions: emptyRestrictions() }))).toBe(0)
  })
})

describe('getRestrictionSummary', () => {
  it('says None when there are no restrictions', () => {
    expect(getRestrictionSummary(makePc('PC-01'))).toBe('None')
  })

  it('counts the active restrictions', () => {
    expect(getRestrictionSummary(makePc('PC-01', { restrictions: onePolicy }))).toBe('1 active')
    expect(getRestrictionSummary(makePc('PC-01', { taskManagerDisabled: true }))).toBe('1 active')
  })
})
