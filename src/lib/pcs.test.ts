import { describe, expect, it } from 'vitest'
import { pcs } from '../data/pcs'
import type { Pc, RegisteredPc, ServerPc } from '../types'
import {
  canEditPcTime,
  canTimeOutPc,
  comparePcNames,
  formatLastUpdate,
  formatTimeUsed,
  toRegisteredPc,
  toSortedRegisteredPcs,
  canLockPc,
  canUnlockPc,
  countOnlinePcs,
  describeBulkLockResult,
  describeTimeEdit,
  describeTimeGrant,
  filterPcs,
  formatMinutes,
  formatPcCount,
  getLogsHref,
  getMessageRecipients,
  getLockToggleTarget,
  getPcIdsToLock,
  getPcIdsToUnlock,
  getTimeAmountError,
  countPcsHiddenFromView,
  getScreenHref,
  getSelectionState,
  getTimeLeftLabel,
  isPcActionable,
  isPcOff,
  isPcOnline,
  isPcUnlockedWithoutUser,
  parseTimeAmount,
  canShutDownPc,
  describeBulkShutdownResult,
  getPcIdsToShutDown,
  getPcNamesToShutDown,
  getServerPcShutDownNote,
  rebootPc,
  toggleSelectAll,
  toggleSelectedName,
  toPcTimeCommand,
  updateActionablePcs,
} from './pcs'

describe('canTimeOutPc', () => {
  it('allows only PCs that are in use', () => {
    const base: Pc = { name: 'PC-T', status: 'in-use', lastSeen: 'Now' }
    expect(canTimeOutPc(base)).toBe(true)
    ;(['locked', 'frozen', 'offline', 'shutdown', 'rebooting'] as const).forEach((status) => {
      expect(canTimeOutPc({ ...base, status })).toBe(false)
    })
  })
})

describe('isPcUnlockedWithoutUser', () => {
  it('is true for an in-use PC with no user', () => {
    expect(isPcUnlockedWithoutUser({ status: 'in-use' })).toBe(true)
  })

  it('is false once a user is logged in', () => {
    expect(isPcUnlockedWithoutUser({ status: 'in-use', user: 'lab-pc01' })).toBe(false)
  })

  it('is false for a PC with no session', () => {
    expect(isPcUnlockedWithoutUser({ status: 'locked' })).toBe(false)
    expect(isPcUnlockedWithoutUser({ status: 'offline' })).toBe(false)
  })
})

describe('canEditPcTime', () => {
  it('allows an in-use PC, which has a running session', () => {
    expect(canEditPcTime({ name: 'A', status: 'in-use', lastSeen: 'Now' })).toBe(true)
    expect(canEditPcTime(inUsePc)).toBe(true)
  })

  it('allows a frozen PC that keeps its session', () => {
    expect(canEditPcTime({ name: 'A', status: 'frozen', timeUsed: '00:30', lastSeen: 'Now' })).toBe(
      true,
    )
  })

  it('refuses a frozen PC with no session', () => {
    expect(canEditPcTime({ name: 'A', status: 'frozen', lastSeen: 'Now' })).toBe(false)
  })

  it('refuses a locked PC, since it has no session', () => {
    expect(canEditPcTime({ name: 'A', status: 'locked', lastSeen: 'Now' })).toBe(false)
  })

  it('refuses offline, shut down and rebooting PCs', () => {
    for (const status of ['offline', 'shutdown', 'rebooting'] as const) {
      expect(canEditPcTime({ name: 'A', status, timeUsed: '00:30', lastSeen: 'Now' })).toBe(false)
    }
  })
})

describe('canLockPc', () => {
  it('allows in-use PCs and PCs with no user', () => {
    expect(canLockPc({ name: 'A', status: 'in-use', lastSeen: 'Now' })).toBe(true)
    expect(canLockPc({ name: 'A', status: 'locked', lastSeen: 'Now' })).toBe(true)
  })

  it('refuses frozen, offline and other PCs', () => {
    for (const status of ['frozen', 'offline', 'shutdown', 'rebooting'] as const) {
      expect(canLockPc({ name: 'A', status, lastSeen: 'Now' })).toBe(false)
    }
  })
})

describe('canUnlockPc', () => {
  it('allows frozen PCs and PCs with no user', () => {
    expect(canUnlockPc({ name: 'A', status: 'frozen', lastSeen: 'Now' })).toBe(true)
    expect(canUnlockPc({ name: 'A', status: 'locked', lastSeen: 'Now' })).toBe(true)
  })

  it('refuses in-use, offline and other PCs', () => {
    for (const status of ['in-use', 'offline', 'shutdown', 'rebooting'] as const) {
      expect(canUnlockPc({ name: 'A', status, lastSeen: 'Now' })).toBe(false)
    }
  })
})

const bulkPcList: RegisteredPc[] = [
  { id: 1, name: 'PC-01', status: 'in-use', lastSeen: 'Now' },
  { id: 2, name: 'PC-02', status: 'locked', lastSeen: 'Now' },
  { id: 3, name: 'PC-03', status: 'frozen', isLocked: true, lastSeen: 'Now' },
  { id: 4, name: 'PC-04', status: 'offline', isLocked: false, lastSeen: '09:00' },
  { id: 5, name: 'PC-05', status: 'offline', isLocked: true, lastSeen: '09:00' },
  { id: 6, name: 'PC-06', status: 'rebooting', lastSeen: 'Now' },
]
const allBulkNames = bulkPcList.map((pc) => pc.name)

describe('countPcsHiddenFromView', () => {
  const all = [
    { id: 1, name: 'PC-01' },
    { id: 2, name: 'PC-02' },
    { id: 3, name: 'PC-03' },
  ] as RegisteredPc[]

  it('counts the chosen PCs that are not on screen', () => {
    expect(countPcsHiddenFromView([1, 2, 3], all, ['PC-01'])).toBe(2)
  })

  it('is zero when every chosen PC is on screen', () => {
    expect(countPcsHiddenFromView([1], all, ['PC-01', 'PC-02'])).toBe(0)
  })
})

describe('getPcIdsToLock', () => {
  it('returns the selected PCs that are not locked yet', () => {
    expect(getPcIdsToLock(bulkPcList, allBulkNames)).toEqual([1, 2])
  })

  it('leaves out offline PCs, locked or not', () => {
    expect(getPcIdsToLock(bulkPcList, ['PC-04', 'PC-05'])).toEqual([])
  })

  it('leaves out PCs that are not selected', () => {
    expect(getPcIdsToLock(bulkPcList, ['PC-01'])).toEqual([1])
  })

  it('returns nothing when no selected PC can be locked', () => {
    expect(getPcIdsToLock(bulkPcList, ['PC-03', 'PC-06'])).toEqual([])
    expect(getPcIdsToLock(bulkPcList, [])).toEqual([])
  })
})

describe('getLockToggleTarget', () => {
  it('unlocks frozen PCs and PCs with no user', () => {
    expect(getLockToggleTarget({ name: 'A', status: 'frozen', lastSeen: 'Now' })).toBe('unlock')
    expect(getLockToggleTarget({ name: 'A', status: 'locked', lastSeen: 'Now' })).toBe('unlock')
  })

  it('locks in-use PCs', () => {
    expect(getLockToggleTarget(inUsePc)).toBe('lock')
  })

  it('unlocks an offline PC that is locked and locks one that is not', () => {
    expect(getLockToggleTarget({ name: 'A', status: 'offline', isLocked: true, lastSeen: '' })).toBe(
      'unlock',
    )
    expect(getLockToggleTarget({ name: 'A', status: 'offline', lastSeen: '' })).toBe('lock')
  })
})

describe('getPcIdsToUnlock', () => {
  it('returns the selected frozen PCs and PCs with no user', () => {
    expect(getPcIdsToUnlock(bulkPcList, allBulkNames)).toEqual([2, 3])
  })

  it('leaves out offline and in-use PCs even when selected', () => {
    expect(getPcIdsToUnlock(bulkPcList, ['PC-01', 'PC-04', 'PC-05'])).toEqual([])
  })

  it('returns nothing when nothing is selected', () => {
    expect(getPcIdsToUnlock(bulkPcList, [])).toEqual([])
  })
})

describe('formatPcCount', () => {
  it('uses the singular for one PC and the plural otherwise', () => {
    expect(formatPcCount(1)).toBe('1 PC')
    expect(formatPcCount(5)).toBe('5 PCs')
    expect(formatPcCount(0)).toBe('0 PCs')
  })
})

describe('describeBulkLockResult', () => {
  it('reports how many PCs were locked or unlocked', () => {
    expect(describeBulkLockResult('unlock', 8)).toBe('Unlocked 8 PCs.')
    expect(describeBulkLockResult('lock', 1)).toBe('Locked 1 PC.')
  })

  it('says when no PCs needed the change', () => {
    expect(describeBulkLockResult('lock', 0)).toBe('No PCs needed locking.')
    expect(describeBulkLockResult('unlock', 0)).toBe('No PCs needed unlocking.')
  })
})

describe('isPcOnline', () => {
  it('is true only for locked, frozen and in-use PCs', () => {
    const onlineByStatus = (
      ['locked', 'frozen', 'in-use', 'offline', 'shutdown', 'rebooting'] as const
    ).map((status) => isPcOnline({ name: 'A', status, lastSeen: 'Now' }))
    expect(onlineByStatus).toEqual([true, true, true, false, false, false])
  })
})

describe('getMessageRecipients', () => {
  const list: Pc[] = [
    { name: 'A', status: 'locked', lastSeen: 'Now' },
    { name: 'B', status: 'in-use', lastSeen: 'Now' },
    { name: 'C', status: 'offline', lastSeen: '09:00' },
    { name: 'D', status: 'rebooting', lastSeen: '10:00' },
    { name: 'E', status: 'frozen', lastSeen: 'Now' },
  ]

  it('returns the selected online PCs', () => {
    expect(getMessageRecipients(list, ['B'])).toEqual(['B'])
  })

  it('includes a frozen PC because it is online', () => {
    expect(getMessageRecipients(list, ['E'])).toEqual(['E'])
  })

  it('leaves out selected PCs that are not online', () => {
    expect(getMessageRecipients(list, ['A', 'C', 'D'])).toEqual(['A'])
  })

  it('returns nothing when nothing is selected', () => {
    expect(getMessageRecipients(list, [])).toEqual([])
  })

  it('returns nothing when no selected PC is online', () => {
    expect(getMessageRecipients(list, ['C', 'D'])).toEqual([])
  })

  it('returns nothing when no PC is online', () => {
    const offlineList: Pc[] = [{ name: 'C', status: 'offline', lastSeen: '09:00' }]
    expect(getMessageRecipients(offlineList, ['C'])).toEqual([])
  })
})

describe('getSelectionState', () => {
  it('reports all, some or none of the visible PCs', () => {
    expect(getSelectionState(['A', 'B'], ['A', 'B'])).toBe('all')
    expect(getSelectionState(['A', 'B'], ['A'])).toBe('some')
    expect(getSelectionState(['A', 'B'], [])).toBe('none')
  })

  it('ignores selected PCs that are not visible', () => {
    expect(getSelectionState(['A'], ['B'])).toBe('none')
    expect(getSelectionState(['A'], ['A', 'B'])).toBe('all')
  })

  it('is none when no PCs are visible', () => {
    expect(getSelectionState([], ['A'])).toBe('none')
  })
})

describe('toggleSelectAll', () => {
  it('selects every visible PC when none or some are selected', () => {
    expect(toggleSelectAll(['A', 'B'], [])).toEqual(['A', 'B'])
    expect(toggleSelectAll(['A', 'B'], ['B'])).toEqual(['B', 'A'])
  })

  it('clears the visible PCs when all are selected', () => {
    expect(toggleSelectAll(['A', 'B'], ['A', 'B'])).toEqual([])
  })

  it('keeps selected PCs that are not visible', () => {
    expect(toggleSelectAll(['A'], ['C'])).toEqual(['C', 'A'])
    expect(toggleSelectAll(['A'], ['A', 'C'])).toEqual(['C'])
  })
})

describe('toggleSelectedName', () => {
  it('adds a PC that is not selected', () => {
    expect(toggleSelectedName(['A'], 'B')).toEqual(['A', 'B'])
  })

  it('removes a PC that is selected', () => {
    expect(toggleSelectedName(['A', 'B'], 'A')).toEqual(['B'])
  })

  it('does not change the input', () => {
    const selected = ['A']
    toggleSelectedName(selected, 'B')
    expect(selected).toEqual(['A'])
  })
})

describe('countOnlinePcs', () => {
  it('counts 40 of 60 for the sample data', () => {
    expect(pcs).toHaveLength(60)
    expect(countOnlinePcs(pcs)).toBe(40)
  })

  it('counts locked, frozen and in-use PCs', () => {
    const list: Pc[] = [
      { name: 'A', status: 'locked', lastSeen: 'Now' },
      { name: 'B', status: 'in-use', lastSeen: 'Now' },
      { name: 'C', status: 'offline', lastSeen: '09:00' },
      { name: 'D', status: 'shutdown', lastSeen: '09:00' },
      { name: 'E', status: 'rebooting', lastSeen: '09:00' },
      { name: 'F', status: 'frozen', lastSeen: 'Now' },
    ]
    expect(countOnlinePcs(list)).toBe(3)
  })

  it('returns 0 for an empty list', () => {
    expect(countOnlinePcs([])).toBe(0)
  })
})

describe('filterPcs', () => {
  it('returns all PCs for an empty or blank query', () => {
    expect(filterPcs(pcs, '')).toHaveLength(60)
    expect(filterPcs(pcs, '   ')).toHaveLength(60)
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
  it('is true for locked, frozen and in-use PCs', () => {
    expect(isPcActionable({ name: 'A', status: 'locked', lastSeen: '' })).toBe(true)
    expect(isPcActionable({ name: 'A', status: 'frozen', lastSeen: '' })).toBe(true)
    expect(isPcActionable(inUsePc)).toBe(true)
    expect(isPcActionable({ name: 'A', status: 'offline', lastSeen: '' })).toBe(false)
    expect(isPcActionable({ name: 'A', status: 'shutdown', lastSeen: '' })).toBe(false)
    expect(isPcActionable({ name: 'A', status: 'rebooting', lastSeen: '' })).toBe(false)
  })
})

describe('canShutDownPc', () => {
  it('allows online PCs that are not the server PC and not already shutting down', () => {
    expect(canShutDownPc({ name: 'A', status: 'locked', lastSeen: 'Now' })).toBe(true)
    expect(canShutDownPc({ name: 'A', status: 'frozen', lastSeen: 'Now' })).toBe(true)
    expect(canShutDownPc(inUsePc)).toBe(true)
  })

  it('refuses offline and shut down PCs', () => {
    for (const status of ['offline', 'shutdown', 'rebooting'] as const) {
      expect(canShutDownPc({ name: 'A', status, lastSeen: 'Now' })).toBe(false)
    }
  })

  it('refuses the server PC even when it is online', () => {
    expect(canShutDownPc({ name: 'SRV', status: 'in-use', isServerPc: true, lastSeen: 'Now' })).toBe(
      false,
    )
  })

  it('refuses a PC that is already shutting down', () => {
    expect(
      canShutDownPc({ name: 'A', status: 'in-use', isShuttingDown: true, lastSeen: 'Now' }),
    ).toBe(false)
  })
})

describe('getPcIdsToShutDown and getPcNamesToShutDown', () => {
  const shutDownList: RegisteredPc[] = [
    { id: 1, name: 'PC-01', status: 'in-use', lastSeen: 'Now' },
    { id: 2, name: 'SRV', status: 'locked', isServerPc: true, lastSeen: 'Now' },
    { id: 3, name: 'PC-03', status: 'frozen', isShuttingDown: true, lastSeen: 'Now' },
    { id: 4, name: 'PC-04', status: 'offline', lastSeen: '09:00' },
    { id: 5, name: 'PC-05', status: 'locked', lastSeen: 'Now' },
  ]

  it('returns the selected PCs that can be shut down', () => {
    expect(getPcIdsToShutDown(shutDownList, ['PC-01', 'PC-05'])).toEqual([1, 5])
    expect(getPcNamesToShutDown(shutDownList, ['PC-01', 'PC-05'])).toEqual(['PC-01', 'PC-05'])
  })

  it('leaves out the server PC even when it is selected', () => {
    const allNames = shutDownList.map((pc) => pc.name)
    expect(getPcIdsToShutDown(shutDownList, allNames)).toEqual([1, 5])
    expect(getPcNamesToShutDown(shutDownList, allNames)).toEqual(['PC-01', 'PC-05'])
  })

  it('leaves out PCs that are offline or already shutting down', () => {
    expect(getPcIdsToShutDown(shutDownList, ['PC-03', 'PC-04'])).toEqual([])
  })

  it('returns nothing when nothing is selected', () => {
    expect(getPcIdsToShutDown(shutDownList, [])).toEqual([])
    expect(getPcNamesToShutDown(shutDownList, [])).toEqual([])
  })
})

describe('describeBulkShutdownResult', () => {
  it('reports how many PCs are shutting down', () => {
    expect(describeBulkShutdownResult(3)).toBe('Shutting down 3 PCs.')
    expect(describeBulkShutdownResult(1)).toBe('Shutting down 1 PC.')
  })

  it('says when no PCs could be shut down', () => {
    expect(describeBulkShutdownResult(0)).toBe('No PCs could be shut down.')
  })
})

describe('getServerPcShutDownNote', () => {
  it('names the server PC and says it is left alone', () => {
    expect(getServerPcShutDownNote('SRV-01')).toBe("SRV-01 runs the server and won't be shut down.")
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

describe('updateActionablePcs', () => {
  it('transforms only named PCs that are actionable', () => {
    const result = updateActionablePcs(pcs, ['PC-01', 'PC-04', 'PC-08'], rebootPc)
    expect(result.find((pc) => pc.name === 'PC-01')?.status).toBe('rebooting')
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

describe('getLogsHref', () => {
  it('builds the logs route filtered to the PC', () => {
    expect(getLogsHref('PC-05')).toBe('/logs?pc=PC-05')
    expect(getLogsHref('PC 5&x')).toBe('/logs?pc=PC%205%26x')
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

describe('getTimeAmountError', () => {
  it('is undefined for a whole amount from 1 to 24 hours', () => {
    expect(getTimeAmountError('1', 'minutes')).toBeUndefined()
    expect(getTimeAmountError('1440', 'minutes')).toBeUndefined()
    expect(getTimeAmountError('24', 'hours')).toBeUndefined()
  })

  it('asks for a whole number of 1 or more when the amount is not one', () => {
    expect(getTimeAmountError('', 'minutes')).toBe('Enter a whole number of 1 or more.')
    expect(getTimeAmountError('0', 'hours')).toBe('Enter a whole number of 1 or more.')
    expect(getTimeAmountError('1.5', 'hours')).toBe('Enter a whole number of 1 or more.')
  })

  it('asks for 24 hours or less when one entry is over 1440 minutes', () => {
    expect(getTimeAmountError('1441', 'minutes')).toBe('Enter 24 hours or less.')
    expect(getTimeAmountError('25', 'hours')).toBe('Enter 24 hours or less.')
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

describe('session end', () => {
  it('clears the time left', () => {
    const limitedPc: Pc = { ...inUsePc, isOpenTime: undefined, minutesLeft: 30 }
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

describe('toPcTimeCommand', () => {
  it('maps a time limit to add-time with its minutes', () => {
    expect(toPcTimeCommand({ mode: 'time-limit', minutes: 90 })).toEqual({
      action: 'add-time',
      minutes: 90,
    })
  })

  it('maps open time to open-time', () => {
    expect(toPcTimeCommand({ mode: 'open-time' })).toEqual({ action: 'open-time' })
  })
})

describe('describeTimeEdit', () => {
  it('describes added time, open time and a time out', () => {
    expect(describeTimeEdit('PC-05', { action: 'add-time', minutes: 90 })).toBe(
      'Added 1h 30m to PC-05.',
    )
    expect(describeTimeEdit('PC-05', { action: 'open-time' })).toBe('PC-05 is now on open time.')
    expect(describeTimeEdit('PC-05', { action: 'time-out' })).toBe('PC-05 timed out.')
  })
})

describe('getScreenHref', () => {
  it('builds the screen route with the view mode', () => {
    expect(getScreenHref('PC-05', 'anonymous')).toBe('/pc/PC-05/screen?mode=anonymous')
  })
})

const serverPc: ServerPc = {
  id: 9,
  name: 'PC-09',
  isOnline: true,
  ipAddress: '192.168.1.19',
  registeredAt: '2026-11-01T08:00:00.000Z',
  lastSeenAt: '2026-11-05T10:00:00.000Z',
  session: null,
  isLocked: false,
  shutdownState: null,
  isServerPc: false,
}

const startedAt = '2026-11-05T10:00:00.000Z'
const now = new Date(startedAt)

function secondsAfterStart(seconds: number): Date {
  return new Date(now.getTime() + seconds * 1000)
}

describe('formatTimeUsed', () => {
  it('is 00:00 with no time elapsed', () => {
    expect(formatTimeUsed(startedAt, now)).toBe('00:00')
  })

  it('rounds partial minutes down', () => {
    expect(formatTimeUsed(startedAt, secondsAfterStart(59))).toBe('00:00')
    expect(formatTimeUsed(startedAt, secondsAfterStart(60))).toBe('00:01')
  })

  it('shows hours and minutes', () => {
    expect(formatTimeUsed(startedAt, secondsAfterStart(3600 + 5 * 60))).toBe('01:05')
    expect(formatTimeUsed(startedAt, secondsAfterStart(100 * 3600))).toBe('100:00')
  })

  it('does not go negative when the clocks disagree', () => {
    expect(formatTimeUsed(startedAt, secondsAfterStart(-30))).toBe('00:00')
  })

  it('is undefined when the start is not a date', () => {
    expect(formatTimeUsed('garbage', now)).toBeUndefined()
  })
})

describe('toRegisteredPc', () => {
  it('shows an in-use PC with the user and time left of a timed session', () => {
    const pc = toRegisteredPc(
      {
        ...serverPc,
        session: {
          username: 'maria',
          startedAt,
          time: { mode: 'time-limit', minutes: 60 },
          secondsRemaining: 1800,
        },
      },
      secondsAfterStart(90 * 60),
    )
    expect(pc).toMatchObject({
      status: 'in-use',
      user: 'maria',
      timeUsed: '01:30',
      minutesLeft: 30,
    })
    expect(pc.isOpenTime).toBeUndefined()
  })

  it('rounds the time left up to the next minute', () => {
    const session = {
      username: 'maria',
      startedAt,
      time: { mode: 'time-limit' as const, minutes: 5 },
    }
    expect(toRegisteredPc({ ...serverPc, session: { ...session, secondsRemaining: 1 } }, now).minutesLeft).toBe(1)
    expect(toRegisteredPc({ ...serverPc, session: { ...session, secondsRemaining: 61 } }, now).minutesLeft).toBe(2)
    expect(toRegisteredPc({ ...serverPc, session: { ...session, secondsRemaining: 0 } }, now).minutesLeft).toBe(0)
  })

  it('shows an admin unlock with no user as open time', () => {
    const pc = toRegisteredPc(
      {
        ...serverPc,
        session: {
          username: null,
          startedAt,
          time: { mode: 'open-time' },
          secondsRemaining: null,
        },
      },
      now,
    )
    expect(pc).toMatchObject({ status: 'in-use', timeUsed: '00:00', isOpenTime: true })
    expect(pc.user).toBeUndefined()
  })

  it('shows open time without minutes left', () => {
    const pc = toRegisteredPc(
      {
        ...serverPc,
        session: {
          username: 'maria',
          startedAt,
          time: { mode: 'open-time' },
          secondsRemaining: null,
        },
      },
      now,
    )
    expect(pc).toMatchObject({ status: 'in-use', user: 'maria', timeUsed: '00:00', isOpenTime: true })
    expect(pc.minutesLeft).toBeUndefined()
  })

  it('ignores a session on an offline PC', () => {
    const pc = toRegisteredPc(
      {
        ...serverPc,
        isOnline: false,
        session: {
          username: 'maria',
          startedAt,
          time: { mode: 'open-time' },
          secondsRemaining: null,
        },
      },
      now,
    )
    expect(pc.status).toBe('offline')
    expect(pc.user).toBeUndefined()
    expect(pc.timeUsed).toBeUndefined()
    expect(pc.isOpenTime).toBeUndefined()
  })

  it('shows an online PC as online with no user, seen now', () => {
    expect(toRegisteredPc(serverPc, now)).toEqual({
      id: 9,
      name: 'PC-09',
      status: 'locked',
      isLocked: false,
      isShuttingDown: false,
      isServerPc: false,
      lastSeen: 'Now',
      ipAddress: '192.168.1.19',
    })
  })

  it('shows a PC the server reports as shut down with the shutdown status', () => {
    const pc = toRegisteredPc({ ...serverPc, isOnline: false, shutdownState: 'shutdown' }, now)
    expect(pc).toMatchObject({ status: 'shutdown', isShuttingDown: false })
  })

  it('shows a shutdown PC as shutdown even when it still answers', () => {
    const pc = toRegisteredPc({ ...serverPc, shutdownState: 'shutdown' }, now)
    expect(pc.status).toBe('shutdown')
  })

  it('keeps the online status of a PC that is shutting down and flags it', () => {
    const pc = toRegisteredPc(
      {
        ...serverPc,
        isLocked: true,
        shutdownState: 'shutting-down',
        session: {
          username: 'maria',
          startedAt,
          time: { mode: 'open-time' },
          secondsRemaining: null,
        },
      },
      now,
    )
    expect(pc).toMatchObject({ status: 'frozen', isShuttingDown: true, user: 'maria' })
  })

  it('carries the server PC flag', () => {
    expect(toRegisteredPc({ ...serverPc, isServerPc: true }, now).isServerPc).toBe(true)
  })

  it('shows a locked online PC as frozen, with no user when it has no session', () => {
    const pc = toRegisteredPc({ ...serverPc, isLocked: true }, now)
    expect(pc).toMatchObject({ status: 'frozen', isLocked: true, lastSeen: 'Now' })
    expect(pc.user).toBeUndefined()
  })

  it('keeps the user and time of a frozen session', () => {
    const pc = toRegisteredPc(
      {
        ...serverPc,
        isLocked: true,
        session: {
          username: 'maria',
          startedAt,
          time: { mode: 'time-limit', minutes: 60 },
          secondsRemaining: 1800,
        },
      },
      secondsAfterStart(60),
    )
    expect(pc).toMatchObject({
      status: 'frozen',
      user: 'maria',
      timeUsed: '00:01',
      minutesLeft: 30,
    })
  })

  it('shows an offline locked PC as offline with the lock flag', () => {
    const pc = toRegisteredPc({ ...serverPc, isOnline: false, isLocked: true }, now)
    expect(pc).toMatchObject({ status: 'offline', isLocked: true })
  })

  it('shows an offline PC with its last seen date and time', () => {
    const pc = toRegisteredPc({ ...serverPc, isOnline: false }, now)
    expect(pc.status).toBe('offline')
    expect(pc.lastSeen).toBe(
      new Date(serverPc.lastSeenAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    )
  })

  it('does not invent a user, time, or restrictions', () => {
    const pc = toRegisteredPc(serverPc, now)
    expect(pc.user).toBeUndefined()
    expect(pc.timeUsed).toBeUndefined()
    expect(pc.minutesLeft).toBeUndefined()
    expect(pc.isOpenTime).toBeUndefined()
    expect(pc.restrictions).toBeUndefined()
  })

  it('leaves the address out when the server has none', () => {
    expect(toRegisteredPc({ ...serverPc, ipAddress: null }, now).ipAddress).toBeUndefined()
  })

  it('says Unknown when the last seen time is not a date', () => {
    expect(toRegisteredPc({ ...serverPc, isOnline: false, lastSeenAt: 'garbage' }, now).lastSeen).toBe(
      'Unknown',
    )
  })
})

describe('comparePcNames', () => {
  it('orders numbers inside names by value', () => {
    expect(comparePcNames('PC-2', 'PC-10')).toBeLessThan(0)
    expect(comparePcNames('PC-10', 'PC-2')).toBeGreaterThan(0)
    expect(comparePcNames('PC-2', 'PC-2')).toBe(0)
  })
})

describe('toSortedRegisteredPcs', () => {
  it('converts and sorts by name numerically without changing the input', () => {
    const input = ['PC-10', 'PC-2', 'PC-1'].map((name, index) => ({ ...serverPc, id: index, name }))
    expect(toSortedRegisteredPcs(input, now).map((pc) => pc.name)).toEqual(['PC-1', 'PC-2', 'PC-10'])
    expect(input.map((pc) => pc.name)).toEqual(['PC-10', 'PC-2', 'PC-1'])
  })

  it('returns an empty list for no PCs', () => {
    expect(toSortedRegisteredPcs([], now)).toEqual([])
  })
})

describe('formatLastUpdate', () => {
  it('formats the time of day', () => {
    const date = new Date(2026, 10, 5, 10, 44, 12)
    expect(formatLastUpdate(date)).toBe(date.toLocaleTimeString(undefined, { timeStyle: 'medium' }))
  })
})
