import { describe, expect, it } from 'vitest'
import type { Pc, PcRestrictions } from '../types'
import {
  EMPTY_RESTRICTIONS,
  applyRestrictions,
  countActiveRestrictions,
  describeRestrictionsApplied,
  getCommonRestrictions,
  getRestrictionSummary,
  hasRebootRestrictions,
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

describe('applyRestrictions', () => {
  it('sets restrictions on the named PCs only', () => {
    const pcs = [makePc('PC-01'), makePc('PC-02')]
    const result = applyRestrictions(pcs, ['PC-01'], noReboot)
    expect(result[0].restrictions).toEqual(noReboot)
    expect(result[1]).toBe(pcs[1])
  })

  it('applies to offline, shutdown and rebooting PCs without changing status', () => {
    const pcs = [
      makePc('PC-01', { status: 'offline' }),
      makePc('PC-02', { status: 'shutdown' }),
      makePc('PC-03', { status: 'rebooting' }),
    ]
    const result = applyRestrictions(pcs, ['PC-01', 'PC-02', 'PC-03'], noReboot)
    expect(result.map((pc) => pc.status)).toEqual(['offline', 'shutdown', 'rebooting'])
    expect(result.every((pc) => pc.restrictions === noReboot)).toBe(true)
  })

  it('keeps session fields unchanged', () => {
    const pc = makePc('PC-01', { status: 'in-use', user: 'ana', timeUsed: '00:10', minutesLeft: 20 })
    const [result] = applyRestrictions([pc], ['PC-01'], noReboot)
    expect(result).toEqual({ ...pc, restrictions: noReboot })
  })

  it('replaces old restrictions instead of merging', () => {
    const pc = makePc('PC-01', {
      restrictions: { policies: ['run-command'], hiddenDrives: ['C'], disabledDrives: ['D'] },
    })
    const [result] = applyRestrictions([pc], ['PC-01'], noReboot)
    expect(result.restrictions).toEqual(noReboot)
  })

  it('does not mutate the input array', () => {
    const pcs = [makePc('PC-01')]
    applyRestrictions(pcs, ['PC-01'], noReboot)
    expect(pcs[0].restrictions).toBeUndefined()
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

describe('hasRebootRestrictions', () => {
  it('is false for empty restrictions', () => {
    expect(hasRebootRestrictions(EMPTY_RESTRICTIONS)).toBe(false)
  })

  it('is false for policies that apply immediately', () => {
    expect(hasRebootRestrictions(noReboot)).toBe(false)
  })

  it('is true for a policy that needs a restart', () => {
    expect(hasRebootRestrictions({ ...EMPTY_RESTRICTIONS, policies: ['task-manager', 'run-command'] })).toBe(true)
  })

  it('is true when a drive is hidden', () => {
    expect(hasRebootRestrictions({ ...EMPTY_RESTRICTIONS, hiddenDrives: ['C'] })).toBe(true)
  })

  it('is true when a drive is disabled', () => {
    expect(hasRebootRestrictions({ ...EMPTY_RESTRICTIONS, disabledDrives: ['D'] })).toBe(true)
  })
})

describe('describeRestrictionsApplied', () => {
  const rebootNeeded: PcRestrictions = { ...EMPTY_RESTRICTIONS, policies: ['run-command'] }

  it('describes cleared restrictions that apply without restart', () => {
    expect(describeRestrictionsApplied(2, EMPTY_RESTRICTIONS, true)).toBe('Restrictions cleared on 2 PCs.')
  })

  it('describes cleared restrictions that need a restart', () => {
    expect(describeRestrictionsApplied(1, EMPTY_RESTRICTIONS, false)).toBe(
      'Restrictions cleared on 1 PC. This takes effect after a restart.',
    )
  })

  it('describes saved restrictions that need a restart', () => {
    expect(describeRestrictionsApplied(3, noReboot, false)).toBe(
      'Restrictions saved for 3 PCs. They take effect after a restart.',
    )
  })

  it('describes applied restrictions that may need a restart', () => {
    expect(describeRestrictionsApplied(1, rebootNeeded, true)).toBe(
      'Restrictions applied to 1 PC. Some may need a restart.',
    )
  })

  it('describes applied restrictions that need no restart', () => {
    expect(describeRestrictionsApplied(2, noReboot, true)).toBe('Restrictions applied to 2 PCs.')
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
