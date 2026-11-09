import { describe, expect, it } from 'vitest'
import type { Pc, PcRestrictions } from '../types'
import {
  EMPTY_RESTRICTIONS,
  countActiveRestrictions,
  getCommonRestrictions,
  getRestrictionSummary,
  toggleAllValues,
  toggleListValue,
} from './restrictions'

function makePc(name: string, overrides: Partial<Pc> = {}): Pc {
  return { name, status: 'locked', lastSeen: 'Now', ...overrides }
}

const noReboot: PcRestrictions = {
  policies: ['task-manager'],
  hiddenDrives: [],
  disabledDrives: [],
}

describe('EMPTY_RESTRICTIONS', () => {
  it('has no policies or drives', () => {
    expect(EMPTY_RESTRICTIONS).toEqual({ policies: [], hiddenDrives: [], disabledDrives: [] })
  })
})

describe('getCommonRestrictions', () => {
  it('returns only the values every PC has', () => {
    const pcs = [
      makePc('PC-01', {
        restrictions: { policies: ['task-manager', 'run-command'], hiddenDrives: ['C', 'D'], disabledDrives: ['E'] },
      }),
      makePc('PC-02', {
        restrictions: { policies: ['task-manager'], hiddenDrives: ['D'], disabledDrives: ['E', 'F'] },
      }),
    ]
    expect(getCommonRestrictions(pcs)).toEqual({
      policies: ['task-manager'],
      hiddenDrives: ['D'],
      disabledDrives: ['E'],
    })
  })

  it('returns empty restrictions when one PC has none', () => {
    const pcs = [makePc('PC-01', { restrictions: noReboot }), makePc('PC-02')]
    expect(getCommonRestrictions(pcs)).toEqual(EMPTY_RESTRICTIONS)
  })

  it('returns the PC restrictions for a single PC', () => {
    expect(getCommonRestrictions([makePc('PC-01', { restrictions: noReboot })])).toEqual(noReboot)
  })

  it('returns empty restrictions for no PCs', () => {
    expect(getCommonRestrictions([])).toEqual(EMPTY_RESTRICTIONS)
  })
})

describe('countActiveRestrictions', () => {
  it('sums policies and drives', () => {
    expect(
      countActiveRestrictions({ policies: ['task-manager', 'run-command'], hiddenDrives: ['C'], disabledDrives: ['D', 'E'] }),
    ).toBe(5)
  })

  it('returns zero when undefined or empty', () => {
    expect(countActiveRestrictions(undefined)).toBe(0)
    expect(countActiveRestrictions(EMPTY_RESTRICTIONS)).toBe(0)
  })
})

describe('getRestrictionSummary', () => {
  it('says None when there are no restrictions', () => {
    expect(getRestrictionSummary(undefined)).toBe('None')
    expect(getRestrictionSummary(EMPTY_RESTRICTIONS)).toBe('None')
  })

  it('shows the active count', () => {
    expect(getRestrictionSummary(noReboot)).toBe('1 active')
  })
})

describe('toggleListValue', () => {
  it('removes a value that is present', () => {
    expect(toggleListValue(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('appends a value that is missing', () => {
    expect(toggleListValue(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const values = ['a']
    toggleListValue(values, 'b')
    expect(values).toEqual(['a'])
  })
})

describe('toggleAllValues', () => {
  it('selects everything when not all are selected', () => {
    expect(toggleAllValues(['a', 'b', 'c'], ['a'])).toEqual(['a', 'b', 'c'])
    expect(toggleAllValues(['a', 'b'], [])).toEqual(['a', 'b'])
  })

  it('clears everything when all are selected', () => {
    expect(toggleAllValues(['a', 'b'], ['b', 'a'])).toEqual([])
  })

  it('returns a copy of the full list', () => {
    const all = ['a', 'b']
    expect(toggleAllValues(all, [])).not.toBe(all)
  })
})
