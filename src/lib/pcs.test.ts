import { describe, expect, it } from 'vitest'
import { pcs } from '../data/pcs'
import type { Pc } from '../types'
import {
  countOnlinePcs,
  describeTimeGrant,
  filterPcs,
  formatMinutes,
  getMessageRecipients,
  getScreenHref,
  getTimeLeftLabel,
  grantPcTime,
  isPcActionable,
  isPcOff,
  isPcOnline,
  lockAllPcs,
  lockPc,
  parseTimeAmount,
  rebootPc,
  shutDownPc,
  togglePcLock,
  unlockAllPcs,
  unlockPc,
  updateActionablePcs,
} from './pcs'

describe('isPcOnline', () => {
  it('is true only for locked and in-use PCs', () => {
    const onlineByStatus = (['locked', 'in-use', 'offline', 'shutdown', 'rebooting'] as const).map(
      (status) => isPcOnline({ name: 'A', status, lastSeen: 'Now' }),
    )
    expect(onlineByStatus).toEqual([true, true, false, false, false])
  })
})

describe('getMessageRecipients', () => {
  const list: Pc[] = [
    { name: 'A', status: 'locked', lastSeen: 'Now' },
    { name: 'B', status: 'in-use', lastSeen: 'Now' },
    { name: 'C', status: 'offline', lastSeen: '09:00' },
    { name: 'D', status: 'rebooting', lastSeen: '10:00' },
  ]

  it('returns the selected online PCs', () => {
    expect(getMessageRecipients(list, ['B'])).toEqual(['B'])
  })

  it('leaves out selected PCs that are not online', () => {
    expect(getMessageRecipients(list, ['A', 'C', 'D'])).toEqual(['A'])
  })

  it('falls back to all online PCs when nothing is selected', () => {
    expect(getMessageRecipients(list, [])).toEqual(['A', 'B'])
  })

  it('falls back to all online PCs when no selected PC is online', () => {
    expect(getMessageRecipients(list, ['C', 'D'])).toEqual(['A', 'B'])
  })

  it('returns nothing when no PC is online', () => {
    const offlineList: Pc[] = [{ name: 'C', status: 'offline', lastSeen: '09:00' }]
    expect(getMessageRecipients(offlineList, ['C'])).toEqual([])
  })
})

describe('countOnlinePcs', () => {
  it('counts 8 of 12 for the sample data', () => {
    expect(pcs).toHaveLength(12)
    expect(countOnlinePcs(pcs)).toBe(8)
  })

  it('counts only locked and in-use', () => {
    const list: Pc[] = [
      { name: 'A', status: 'locked', lastSeen: 'Now' },
      { name: 'B', status: 'in-use', lastSeen: 'Now' },
      { name: 'C', status: 'offline', lastSeen: '09:00' },
      { name: 'D', status: 'shutdown', lastSeen: '09:00' },
      { name: 'E', status: 'rebooting', lastSeen: '09:00' },
    ]
    expect(countOnlinePcs(list)).toBe(2)
  })

  it('returns 0 for an empty list', () => {
    expect(countOnlinePcs([])).toBe(0)
  })
})

describe('filterPcs', () => {
  it('returns all PCs for an empty or blank query', () => {
    expect(filterPcs(pcs, '')).toHaveLength(12)
    expect(filterPcs(pcs, '   ')).toHaveLength(12)
  })

  it('matches PC name case-insensitively', () => {
    expect(filterPcs(pcs, 'pc-05').map((pc) => pc.name)).toEqual(['PC-05'])
  })

  it('matches user and trims the query', () => {
    expect(filterPcs(pcs, '  LAB-PC09 ').map((pc) => pc.name)).toEqual(['PC-09'])
  })

  it('ignores PCs without a user when matching by user', () => {
    expect(filterPcs(pcs, 'lab-pc02')).toEqual([])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterPcs(pcs, 'zzz')).toEqual([])
  })
})

describe('isPcOff', () => {
  it('is true for offline and shutdown', () => {
    expect(isPcOff({ name: 'A', status: 'offline', lastSeen: '' })).toBe(true)
    expect(isPcOff({ name: 'A', status: 'shutdown', lastSeen: '' })).toBe(true)
  })

  it('is false for other statuses', () => {
    expect(isPcOff({ name: 'A', status: 'locked', lastSeen: '' })).toBe(false)
    expect(isPcOff({ name: 'A', status: 'in-use', lastSeen: '' })).toBe(false)
    expect(isPcOff({ name: 'A', status: 'rebooting', lastSeen: '' })).toBe(false)
  })
})

const inUsePc: Pc = {
  name: 'PC-05',
  status: 'in-use',
  user: 'lab-pc05',
  timeUsed: '01:12',
  lastSeen: 'Now',
  ipAddress: '192.168.1.25',
  isOpenTime: true,
}

describe('isPcActionable', () => {
  it('is true only for locked and in-use PCs', () => {
    expect(isPcActionable({ name: 'A', status: 'locked', lastSeen: '' })).toBe(true)
    expect(isPcActionable(inUsePc)).toBe(true)
    expect(isPcActionable({ name: 'A', status: 'offline', lastSeen: '' })).toBe(false)
    expect(isPcActionable({ name: 'A', status: 'shutdown', lastSeen: '' })).toBe(false)
    expect(isPcActionable({ name: 'A', status: 'rebooting', lastSeen: '' })).toBe(false)
  })
})

describe('lockPc', () => {
  it('locks and clears the session details', () => {
    const result = lockPc(inUsePc)
    expect(result).toMatchObject({ status: 'locked', ipAddress: '192.168.1.25' })
    expect(result.user).toBeUndefined()
    expect(result.timeUsed).toBeUndefined()
    expect(result.isOpenTime).toBeUndefined()
  })

  it('does not mutate the input', () => {
    lockPc(inUsePc)
    expect(inUsePc.status).toBe('in-use')
  })
})

describe('unlockPc', () => {
  it('sets in-use with a fresh timer', () => {
    expect(unlockPc({ name: 'A', status: 'locked', lastSeen: 'Now' })).toEqual({
      name: 'A',
      status: 'in-use',
      timeUsed: '00:00',
      lastSeen: 'Now',
    })
  })
})

describe('shutDownPc', () => {
  it('sets shutdown, clears the session and marks last seen as Now', () => {
    const result = shutDownPc({ ...inUsePc, lastSeen: '10:00' })
    expect(result).toMatchObject({ status: 'shutdown', lastSeen: 'Now' })
    expect(result.user).toBeUndefined()
    expect(result.timeUsed).toBeUndefined()
    expect(result.isOpenTime).toBeUndefined()
  })
})

describe('rebootPc', () => {
  it('sets rebooting and clears the session', () => {
    const result = rebootPc({ ...inUsePc, lastSeen: '10:00' })
    expect(result).toMatchObject({ status: 'rebooting', lastSeen: '10:00' })
    expect(result.user).toBeUndefined()
    expect(result.timeUsed).toBeUndefined()
    expect(result.isOpenTime).toBeUndefined()
  })
})

describe('togglePcLock', () => {
  it('locks an in-use PC and unlocks a locked one', () => {
    expect(togglePcLock(inUsePc).status).toBe('locked')
    expect(togglePcLock({ name: 'A', status: 'locked', lastSeen: '' }).status).toBe('in-use')
  })

  it('leaves other statuses unchanged', () => {
    const rebooting: Pc = { name: 'A', status: 'rebooting', lastSeen: '' }
    expect(togglePcLock(rebooting)).toBe(rebooting)
  })
})

describe('lockAllPcs and unlockAllPcs', () => {
  it('lock all affects only in-use PCs', () => {
    const result = lockAllPcs(pcs)
    expect(result.filter((pc) => pc.status === 'in-use')).toHaveLength(0)
    expect(result.find((pc) => pc.name === 'PC-04')?.status).toBe('offline')
    expect(result.find((pc) => pc.name === 'PC-08')?.status).toBe('rebooting')
    expect(result.filter((pc) => pc.status === 'locked')).toHaveLength(8)
  })

  it('unlock all affects only locked PCs', () => {
    const result = unlockAllPcs(pcs)
    expect(result.filter((pc) => pc.status === 'locked')).toHaveLength(0)
    expect(result.find((pc) => pc.name === 'PC-07')?.status).toBe('shutdown')
    expect(result.find((pc) => pc.name === 'PC-05')?.user).toBe('lab-pc05')
    expect(result.filter((pc) => pc.status === 'in-use')).toHaveLength(8)
  })
})

describe('updateActionablePcs', () => {
  it('transforms only named PCs that are actionable', () => {
    const result = updateActionablePcs(pcs, ['PC-01', 'PC-04', 'PC-08'], shutDownPc)
    expect(result.find((pc) => pc.name === 'PC-01')?.status).toBe('shutdown')
    expect(result.find((pc) => pc.name === 'PC-04')?.status).toBe('offline')
    expect(result.find((pc) => pc.name === 'PC-08')?.status).toBe('rebooting')
    expect(result.find((pc) => pc.name === 'PC-02')?.status).toBe('locked')
  })

  it('skips off and rebooting PCs without calling the transform', () => {
    const off: Pc[] = [
      { name: 'A', status: 'offline', lastSeen: '' },
      { name: 'B', status: 'shutdown', lastSeen: '' },
      { name: 'C', status: 'rebooting', lastSeen: '' },
    ]
    const calls: string[] = []
    const result = updateActionablePcs(off, ['A', 'B', 'C'], (pc) => {
      calls.push(pc.name)
      return rebootPc(pc)
    })
    expect(calls).toEqual([])
    expect(result).toEqual(off)
  })
})

describe('parseTimeAmount', () => {
  it('converts minutes and hours to minutes', () => {
    expect(parseTimeAmount('45', 'minutes')).toBe(45)
    expect(parseTimeAmount('2', 'hours')).toBe(120)
    expect(parseTimeAmount(' 30 ', 'minutes')).toBe(30)
  })

  it('rejects anything but a whole number of 1 or more', () => {
    for (const amount of ['', '  ', '0', '-5', '1.5', '1e3', 'abc', '99999999999999999999']) {
      expect(parseTimeAmount(amount, 'minutes')).toBeNull()
    }
  })
})

describe('formatMinutes', () => {
  it('formats minutes, whole hours and mixed values', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(90)).toBe('1h 30m')
  })
})

describe('getTimeLeftLabel', () => {
  it('shows open time, the remaining time, or nothing', () => {
    expect(getTimeLeftLabel(inUsePc)).toBe('Open time')
    expect(getTimeLeftLabel({ ...inUsePc, isOpenTime: undefined, minutesLeft: 90 })).toBe('1h 30m')
    expect(getTimeLeftLabel({ name: 'A', status: 'locked', lastSeen: '' })).toBeUndefined()
  })
})

describe('grantPcTime', () => {
  const limitedPc: Pc = { ...inUsePc, isOpenTime: undefined, minutesLeft: 30 }
  const lockedPc: Pc = { name: 'A', status: 'locked', lastSeen: 'Now' }

  it('adds to the time left on a limited session', () => {
    expect(grantPcTime(limitedPc, { mode: 'time-limit', minutes: 60 })).toMatchObject({
      status: 'in-use',
      timeUsed: '01:12',
      minutesLeft: 90,
    })
  })

  it('removes the limit when switching to open time', () => {
    const result = grantPcTime(limitedPc, { mode: 'open-time' })
    expect(result.isOpenTime).toBe(true)
    expect(result.minutesLeft).toBeUndefined()
  })

  it('switches an open session to a limit of the given amount', () => {
    const result = grantPcTime(inUsePc, { mode: 'time-limit', minutes: 45 })
    expect(result.isOpenTime).toBeUndefined()
    expect(result.minutesLeft).toBe(45)
  })

  it('unlocks a locked PC and starts a session', () => {
    expect(grantPcTime(lockedPc, { mode: 'time-limit', minutes: 60 })).toMatchObject({
      status: 'in-use',
      timeUsed: '00:00',
      minutesLeft: 60,
    })
    expect(grantPcTime(lockedPc, { mode: 'open-time' })).toMatchObject({
      status: 'in-use',
      timeUsed: '00:00',
      isOpenTime: true,
    })
  })

  it('does not mutate the input', () => {
    grantPcTime(limitedPc, { mode: 'time-limit', minutes: 60 })
    expect(limitedPc.minutesLeft).toBe(30)
  })
})

describe('session end', () => {
  it('clears the time left', () => {
    const limitedPc: Pc = { ...inUsePc, isOpenTime: undefined, minutesLeft: 30 }
    expect(lockPc(limitedPc).minutesLeft).toBeUndefined()
    expect(shutDownPc(limitedPc).minutesLeft).toBeUndefined()
    expect(rebootPc(limitedPc).minutesLeft).toBeUndefined()
  })
})

describe('describeTimeGrant', () => {
  it('describes added time and open time', () => {
    expect(describeTimeGrant('PC-05', { mode: 'time-limit', minutes: 90 })).toBe(
      'Added 1h 30m to PC-05.',
    )
    expect(describeTimeGrant('PC-05', { mode: 'open-time' })).toBe('PC-05 is now on open time.')
  })
})

describe('getScreenHref', () => {
  it('builds the screen route with the view mode', () => {
    expect(getScreenHref('PC-05', 'anonymous')).toBe('/pc/PC-05/screen?mode=anonymous')
  })
})
