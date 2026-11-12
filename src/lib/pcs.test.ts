import { describe, expect, it } from 'vitest'
import { pcs } from '../data/pcs'
import type { Pc, PcStatus, RegisteredPc, ServerPc } from '../types'
import {
  canCancelPcPower,
  describeBulkCancelResult,
  describeCancelPowerRequest,
  getCancelPowerLabel,
  getPcIdsToCancelPower,
  isPowerCancelButtonShown,
  canEditPcTime,
  canTimeOutPc,
  formatLastUpdate,
  formatTimeUsed,
  toRegisteredPc,
  toRegisteredPcs,
  canLockPc,
  canUnlockPc,
  countOnlinePcs,
  describeBulkLockResult,
  describeBulkTimeResult,
  describeTimeEdit,
  describeTimeGrant,
  getBulkTimeTargetIds,
  getPcIdsToEditTime,
  getPcIdsToUpdateClient,
  filterPcs,
  formatMinutes,
  formatPcCount,
  getLogsHref,
  getPcNumberFromName,
  describeRename,
  getMessageTargets,
  getLockToggleTarget,
  getPcIdsToLock,
  getPcIdsToUnlock,
  getTimeAmountError,
  countPcsHiddenFromView,
  canViewPcScreen,
  describeBulkWallpaperResult,
  countOfflinePcsToKeepAwake,
  describeKeepAwakeResult,
  getPcIdsToKeepAwake,
  anyPcHasWallpaper,
  getScreenHref,
  parsePcIdParam,
  getServiceWarning,
  isServiceReportFresh,
  getSelectionState,
  getTimeLeftLabel,
  isPcActionable,
  isPcOff,
  isPcOnline,
  isPcUnlockedWithoutUser,
  parseTimeAmount,
  canRebootPc,
  canShutDownPc,
  describeBulkPowerResult,
  describeSinglePowerResult,
  getPcIdsToReboot,
  getPcIdsToShutDown,
  getPcNamesToReboot,
  getPcNamesToShutDown,
  getServerPcPowerNote,
  toggleSelectAll,
  toggleSelectedId,
  toPcTimeCommand,
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
const allBulkIds = bulkPcList.map((pc) => pc.id)

describe('countPcsHiddenFromView', () => {
  const all = [
    { id: 1, name: 'PC-01' },
    { id: 2, name: 'PC-02' },
    { id: 3, name: 'PC-03' },
  ] as RegisteredPc[]

  it('counts the chosen PCs that are not on screen', () => {
    expect(countPcsHiddenFromView([1, 2, 3], all, [1])).toBe(2)
  })

  it('is zero when every chosen PC is on screen', () => {
    expect(countPcsHiddenFromView([1], all, [1, 2])).toBe(0)
  })
})

describe('getPcIdsToLock', () => {
  it('returns the selected PCs that are not locked yet', () => {
    expect(getPcIdsToLock(bulkPcList, allBulkIds)).toEqual([1, 2])
  })

  it('leaves out offline PCs, locked or not', () => {
    expect(getPcIdsToLock(bulkPcList, [4, 5])).toEqual([])
  })

  it('leaves out PCs that are not selected', () => {
    expect(getPcIdsToLock(bulkPcList, [1])).toEqual([1])
  })

  it('returns nothing when no selected PC can be locked', () => {
    expect(getPcIdsToLock(bulkPcList, [3, 6])).toEqual([])
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
    expect(getPcIdsToUnlock(bulkPcList, allBulkIds)).toEqual([2, 3])
  })

  it('leaves out offline and in-use PCs even when selected', () => {
    expect(getPcIdsToUnlock(bulkPcList, [1, 4, 5])).toEqual([])
  })

  it('returns nothing when nothing is selected', () => {
    expect(getPcIdsToUnlock(bulkPcList, [])).toEqual([])
  })
})

describe('getPcIdsToUpdateClient', () => {
  it('returns only the selected PCs that are online', () => {
    expect(getPcIdsToUpdateClient(bulkPcList, allBulkIds)).toEqual([1, 2, 3])
  })

  it('leaves out offline, shut down and restarting PCs', () => {
    const shutDown: RegisteredPc = { id: 7, name: 'PC-07', status: 'shutdown', lastSeen: '09:00' }
    expect(getPcIdsToUpdateClient([...bulkPcList, shutDown], [4, 5, 6, 7])).toEqual([])
  })

  it('returns nothing when nothing is selected', () => {
    expect(getPcIdsToUpdateClient(bulkPcList, [])).toEqual([])
  })
})

describe('getPcIdsToEditTime', () => {
  it('returns the selected PCs whose session time can be edited, including a locked PC that keeps its session', () => {
    const lockedWithSession: RegisteredPc = {
      id: 7,
      name: 'PC-07',
      status: 'frozen',
      timeUsed: '00:30',
      lastSeen: 'Now',
    }
    expect(getPcIdsToEditTime(bulkPcList, allBulkIds)).toEqual([1])
    expect(getPcIdsToEditTime([...bulkPcList, lockedWithSession], [1, 7])).toEqual([1, 7])
  })

  it('leaves out locked PCs with no session, offline PCs and PCs that are not selected', () => {
    expect(getPcIdsToEditTime(bulkPcList, [2, 4, 5, 6])).toEqual([])
    expect(getPcIdsToEditTime(bulkPcList, [1])).toEqual([1])
  })

  it('returns nothing when nothing is selected', () => {
    expect(getPcIdsToEditTime(bulkPcList, [])).toEqual([])
  })
})

describe('getBulkTimeTargetIds', () => {
  const inUse = (id: number, user: string): RegisteredPc => ({
    id,
    name: `PC-${id}`,
    status: 'in-use',
    user,
    timeUsed: '00:10',
    lastSeen: 'Now',
  })

  it('keeps the PCs that still have the same session', () => {
    const openedWith = [inUse(1, 'ana'), inUse(2, 'ben')]
    expect(getBulkTimeTargetIds(openedWith, openedWith)).toEqual([1, 2])
  })

  it('leaves out a PC another user has logged in to since the dialog opened', () => {
    expect(getBulkTimeTargetIds([inUse(1, 'ana'), inUse(2, 'ben')], [inUse(1, 'ana'), inUse(2, 'cara')])).toEqual([1])
  })

  it('leaves out a PC whose session ended or that was removed', () => {
    const ended: RegisteredPc = { id: 2, name: 'PC-2', status: 'locked', lastSeen: 'Now' }
    expect(getBulkTimeTargetIds([inUse(1, 'ana'), inUse(2, 'ben'), inUse(3, 'cy')], [inUse(1, 'ana'), ended])).toEqual([1])
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

describe('getMessageTargets', () => {
  const list: RegisteredPc[] = [
    { id: 1, name: 'A', status: 'locked', lastSeen: 'Now' },
    { id: 2, name: 'B', status: 'in-use', lastSeen: 'Now' },
    { id: 3, name: 'C', status: 'offline', lastSeen: '09:00' },
    { id: 4, name: 'D', status: 'rebooting', lastSeen: '10:00' },
    { id: 5, name: 'E', status: 'frozen', lastSeen: 'Now' },
  ]

  it('returns the selected online PCs as recipients', () => {
    expect(getMessageTargets(list, [2])).toEqual({ recipients: [list[1]], offlineCount: 0 })
  })

  it('includes a frozen PC because it is online', () => {
    expect(getMessageTargets(list, [5]).recipients).toEqual([list[4]])
  })

  it('counts selected PCs that are not online as offline', () => {
    expect(getMessageTargets(list, [1, 3, 4])).toEqual({
      recipients: [list[0]],
      offlineCount: 2,
    })
  })

  it('returns no recipients and no offline count when nothing is selected', () => {
    expect(getMessageTargets(list, [])).toEqual({ recipients: [], offlineCount: 0 })
  })

  it('returns no recipients when every selected PC is offline', () => {
    expect(getMessageTargets(list, [3, 4])).toEqual({ recipients: [], offlineCount: 2 })
  })

  it('ignores selected ids that are not in the list', () => {
    expect(getMessageTargets(list, [99])).toEqual({ recipients: [], offlineCount: 0 })
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

describe('toggleSelectedId', () => {
  it('adds a PC that is not selected', () => {
    expect(toggleSelectedId([1], 2)).toEqual([1, 2])
  })

  it('removes a PC that is selected', () => {
    expect(toggleSelectedId([1, 2], 1)).toEqual([2])
  })

  it('does not change the input', () => {
    const selected = [1]
    toggleSelectedId(selected, 2)
    expect(selected).toEqual([1])
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

  it('refuses a PC that is restarting', () => {
    expect(canShutDownPc({ name: 'A', status: 'locked', isRestarting: true, lastSeen: 'Now' })).toBe(
      false,
    )
  })

  it('refuses a PC that is cancelling a power command', () => {
    expect(canShutDownPc({ name: 'A', status: 'locked', isCancelling: true, lastSeen: 'Now' })).toBe(
      false,
    )
  })
})

describe('canRebootPc', () => {
  it('allows online PCs that are not the server PC and not in a countdown', () => {
    expect(canRebootPc({ name: 'A', status: 'locked', lastSeen: 'Now' })).toBe(true)
    expect(canRebootPc({ name: 'A', status: 'frozen', lastSeen: 'Now' })).toBe(true)
    expect(canRebootPc(inUsePc)).toBe(true)
  })

  it('refuses offline, shut down and rebooting PCs', () => {
    for (const status of ['offline', 'shutdown', 'rebooting'] as const) {
      expect(canRebootPc({ name: 'A', status, lastSeen: 'Now' })).toBe(false)
    }
  })

  it('refuses the server PC even when it is online', () => {
    expect(canRebootPc({ name: 'SRV', status: 'in-use', isServerPc: true, lastSeen: 'Now' })).toBe(
      false,
    )
  })

  it('refuses a PC that is shutting down or restarting', () => {
    expect(canRebootPc({ name: 'A', status: 'in-use', isShuttingDown: true, lastSeen: 'Now' })).toBe(
      false,
    )
    expect(canRebootPc({ name: 'A', status: 'locked', isRestarting: true, lastSeen: 'Now' })).toBe(
      false,
    )
  })

  it('refuses a PC that is cancelling a power command', () => {
    expect(canRebootPc({ name: 'A', status: 'locked', isCancelling: true, lastSeen: 'Now' })).toBe(
      false,
    )
  })
})

describe('getPcIdsToReboot and getPcNamesToReboot', () => {
  const rebootList: RegisteredPc[] = [
    { id: 1, name: 'PC-01', status: 'in-use', lastSeen: 'Now' },
    { id: 2, name: 'SRV', status: 'locked', isServerPc: true, lastSeen: 'Now' },
    { id: 3, name: 'PC-03', status: 'frozen', isRestarting: true, lastSeen: 'Now' },
    { id: 4, name: 'PC-04', status: 'offline', lastSeen: '09:00' },
    { id: 5, name: 'PC-05', status: 'locked', isShuttingDown: true, lastSeen: 'Now' },
    { id: 6, name: 'PC-06', status: 'locked', lastSeen: 'Now' },
  ]

  it('returns the selected PCs that can be restarted', () => {
    expect(getPcIdsToReboot(rebootList, [1, 6])).toEqual([1, 6])
    expect(getPcNamesToReboot(rebootList, [1, 6])).toEqual(['PC-01', 'PC-06'])
  })

  it('leaves out the server PC even when it is selected', () => {
    const allIds = rebootList.map((pc) => pc.id)
    expect(getPcIdsToReboot(rebootList, allIds)).toEqual([1, 6])
    expect(getPcNamesToReboot(rebootList, allIds)).toEqual(['PC-01', 'PC-06'])
  })

  it('leaves out PCs that are offline, shutting down or restarting', () => {
    expect(getPcIdsToReboot(rebootList, [3, 4, 5])).toEqual([])
  })

  it('returns nothing when nothing is selected', () => {
    expect(getPcIdsToReboot(rebootList, [])).toEqual([])
    expect(getPcNamesToReboot(rebootList, [])).toEqual([])
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
    expect(getPcIdsToShutDown(shutDownList, [1, 5])).toEqual([1, 5])
    expect(getPcNamesToShutDown(shutDownList, [1, 5])).toEqual(['PC-01', 'PC-05'])
  })

  it('leaves out the server PC even when it is selected', () => {
    const allIds = shutDownList.map((pc) => pc.id)
    expect(getPcIdsToShutDown(shutDownList, allIds)).toEqual([1, 5])
    expect(getPcNamesToShutDown(shutDownList, allIds)).toEqual(['PC-01', 'PC-05'])
  })

  it('leaves out PCs that are offline or already shutting down', () => {
    expect(getPcIdsToShutDown(shutDownList, [3, 4])).toEqual([])
  })

  it('returns nothing when nothing is selected', () => {
    expect(getPcIdsToShutDown(shutDownList, [])).toEqual([])
    expect(getPcNamesToShutDown(shutDownList, [])).toEqual([])
  })
})

describe('describeBulkPowerResult', () => {
  it('reports how many PCs are shutting down', () => {
    expect(describeBulkPowerResult('shutdown', 3)).toBe('Shutting down 3 PCs.')
    expect(describeBulkPowerResult('shutdown', 1)).toBe('Shutting down 1 PC.')
  })

  it('reports how many PCs are restarting', () => {
    expect(describeBulkPowerResult('reboot', 3)).toBe('Restarting 3 PCs.')
    expect(describeBulkPowerResult('reboot', 1)).toBe('Restarting 1 PC.')
  })

  it('says when no PCs could be shut down or restarted', () => {
    expect(describeBulkPowerResult('shutdown', 0)).toBe('No PCs could be shut down.')
    expect(describeBulkPowerResult('reboot', 0)).toBe('No PCs could be restarted.')
  })
})

describe('describeSinglePowerResult', () => {
  it('says the PC is shutting down or restarting', () => {
    expect(describeSinglePowerResult('PC-05', 'shutdown')).toBe('PC-05 is shutting down.')
    expect(describeSinglePowerResult('PC-05', 'reboot')).toBe('PC-05 is restarting.')
  })
})

describe('canCancelPcPower', () => {
  it('allows a PC in a shutdown or restart countdown', () => {
    expect(canCancelPcPower({ name: 'A', status: 'in-use', isShuttingDown: true, lastSeen: 'Now' })).toBe(true)
    expect(canCancelPcPower({ name: 'A', status: 'locked', isRestarting: true, lastSeen: 'Now' })).toBe(true)
  })

  it('refuses a PC that is already cancelling', () => {
    expect(canCancelPcPower({ name: 'A', status: 'locked', isCancelling: true, lastSeen: 'Now' })).toBe(false)
  })

  it('refuses a PC with no countdown, including an offline or rebooting PC', () => {
    expect(canCancelPcPower({ name: 'A', status: 'locked', lastSeen: 'Now' })).toBe(false)
    expect(canCancelPcPower({ name: 'A', status: 'offline', lastSeen: 'Now' })).toBe(false)
    expect(canCancelPcPower({ name: 'A', status: 'rebooting', lastSeen: 'Now' })).toBe(false)
  })
})

describe('isPowerCancelButtonShown', () => {
  it('shows the cancel button for a PC that can be cancelled or is cancelling', () => {
    expect(isPowerCancelButtonShown({ name: 'A', status: 'locked', isRestarting: true, lastSeen: 'Now' })).toBe(true)
    expect(isPowerCancelButtonShown({ name: 'A', status: 'locked', isCancelling: true, lastSeen: 'Now' })).toBe(true)
  })

  it('hides the cancel button for a PC with no countdown', () => {
    expect(isPowerCancelButtonShown({ name: 'A', status: 'locked', lastSeen: 'Now' })).toBe(false)
  })
})

describe('getCancelPowerLabel', () => {
  it('names the action that can be cancelled', () => {
    expect(getCancelPowerLabel({ name: 'A', status: 'in-use', isShuttingDown: true, lastSeen: 'Now' })).toBe('Cancel shutdown')
    expect(getCancelPowerLabel({ name: 'A', status: 'locked', isRestarting: true, lastSeen: 'Now' })).toBe('Cancel restart')
  })

  it('says Cancelling while the cancel is pending', () => {
    expect(getCancelPowerLabel({ name: 'A', status: 'locked', isCancelling: true, lastSeen: 'Now' })).toBe('Cancelling')
  })
})

describe('getPcIdsToCancelPower', () => {
  const cancelList: RegisteredPc[] = [
    { id: 1, name: 'PC-01', status: 'in-use', isShuttingDown: true, lastSeen: 'Now' },
    { id: 2, name: 'PC-02', status: 'locked', lastSeen: 'Now' },
    { id: 3, name: 'PC-03', status: 'frozen', isRestarting: true, lastSeen: 'Now' },
    { id: 4, name: 'PC-04', status: 'locked', isCancelling: true, lastSeen: 'Now' },
    { id: 5, name: 'PC-05', status: 'locked', isRestarting: true, lastSeen: 'Now' },
  ]

  it('takes only the selected PCs that can be cancelled', () => {
    expect(getPcIdsToCancelPower(cancelList, [1, 2, 4])).toEqual([1])
  })

  it('takes every selected PC in a countdown and skips the rest', () => {
    expect(getPcIdsToCancelPower(cancelList, [1, 3, 5])).toEqual([1, 3, 5])
  })

  it('takes nothing when no selected PC is in a countdown', () => {
    expect(getPcIdsToCancelPower(cancelList, [2, 4])).toEqual([])
    expect(getPcIdsToCancelPower(cancelList, [])).toEqual([])
  })
})

describe('describeCancelPowerRequest', () => {
  it('says the cancel was asked for, not that it happened', () => {
    expect(describeCancelPowerRequest('PC-02')).toBe('Asking PC-02 to cancel.')
  })
})

describe('describeBulkCancelResult', () => {
  it('counts the PCs asked to cancel', () => {
    expect(describeBulkCancelResult(1)).toBe('Asking 1 PC to cancel.')
    expect(describeBulkCancelResult(3)).toBe('Asking 3 PCs to cancel.')
  })

  it('says when no PC had a countdown to cancel', () => {
    expect(describeBulkCancelResult(0)).toBe('No PCs had a shutdown or restart to cancel.')
  })
})

describe('getServerPcPowerNote', () => {
  it('names the server PC and says it is left alone', () => {
    expect(getServerPcPowerNote('SRV-01')).toBe(
      "SRV-01 runs the server and won't be shut down or restarted.",
    )
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

describe('describeBulkTimeResult', () => {
  it('reports the time added to how many PCs', () => {
    expect(describeBulkTimeResult({ action: 'add-time', minutes: 30 }, 12)).toBe(
      'Added 30m to 12 PCs.',
    )
    expect(describeBulkTimeResult({ action: 'add-time', minutes: 90 }, 1)).toBe('Added 1h 30m to 1 PC.')
  })

  it('reports how many PCs are now on open time, using the matching verb', () => {
    expect(describeBulkTimeResult({ action: 'open-time' }, 12)).toBe('12 PCs are now on open time.')
    expect(describeBulkTimeResult({ action: 'open-time' }, 1)).toBe('1 PC is now on open time.')
  })

  it('reports how many PCs were timed out', () => {
    expect(describeBulkTimeResult({ action: 'time-out' }, 12)).toBe('Timed out 12 PCs.')
    expect(describeBulkTimeResult({ action: 'time-out' }, 1)).toBe('Timed out 1 PC.')
  })

  it('says when no PC was changed, for each kind of edit', () => {
    expect(describeBulkTimeResult({ action: 'add-time', minutes: 30 }, 0)).toBe(
      'No PCs could get more time.',
    )
    expect(describeBulkTimeResult({ action: 'open-time' }, 0)).toBe(
      'No PCs could be put on open time.',
    )
    expect(describeBulkTimeResult({ action: 'time-out' }, 0)).toBe('No PCs could be timed out.')
  })
})

describe('canViewPcScreen', () => {
  const pcWith = (status: PcStatus): Pc => ({ name: 'PC-05', status, lastSeen: 'Now' })

  it('allows viewing an online PC, including one that is locked or rebooting', () => {
    expect(canViewPcScreen(pcWith('locked'))).toBe(true)
    expect(canViewPcScreen(pcWith('frozen'))).toBe(true)
    expect(canViewPcScreen(pcWith('in-use'))).toBe(true)
    expect(canViewPcScreen(pcWith('rebooting'))).toBe(true)
  })

  it('blocks viewing an offline or shut down PC', () => {
    expect(canViewPcScreen(pcWith('offline'))).toBe(false)
    expect(canViewPcScreen(pcWith('shutdown'))).toBe(false)
  })
})

describe('parsePcIdParam', () => {
  it('reads a positive whole number', () => {
    expect(parsePcIdParam('5')).toBe(5)
  })

  it.each([undefined, '', '0', '-1', '2.5', 'PC-05', '99999999999999999999'])(
    'returns null for %s',
    (param) => {
      expect(parsePcIdParam(param)).toBeNull()
    },
  )
})

describe('getScreenHref', () => {
  it('builds the screen route from the PC id with the view mode', () => {
    expect(getScreenHref(5, 'anonymous')).toBe('/pc/5/screen?mode=anonymous')
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
  internetBlocked: false,
  internetBlockApplied: null,
  clientVersion: null,
  clientUpdate: null,
  wallpaper: null,
  service: null,
  keepAwake: false,
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
  it('carries the client version and queued update to the PC', () => {
    const clientUpdate = {
      targetVersion: '0.20.0',
      state: 'downloading' as const,
      error: null,
      installNow: false,
    }
    const pc = toRegisteredPc({ ...serverPc, clientVersion: '0.19.0', clientUpdate }, now)
    expect(pc).toMatchObject({ clientVersion: '0.19.0', clientUpdate })
  })

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
      isRestarting: false,
      isCancelling: false,
      isServerPc: false,
      internetBlocked: false,
      internetBlockApplied: null,
      clientVersion: null,
      clientUpdate: null,
      wallpaperId: null,
      service: null,
      keepAwake: false,
      lastSeen: 'Now',
      ipAddress: '192.168.1.19',
    })
  })

  it('keeps the online status of a PC that is cancelling a power command and flags it', () => {
    const pc = toRegisteredPc({ ...serverPc, isLocked: true, shutdownState: 'cancelling' }, now)
    expect(pc).toMatchObject({ status: 'frozen', isCancelling: true })
    expect(pc.isShuttingDown).toBe(false)
    expect(pc.isRestarting).toBe(false)
    expect(isPcOnline(pc)).toBe(true)
  })

  it('shows a PC the server reports as shut down with the shutdown status', () => {
    const pc = toRegisteredPc({ ...serverPc, isOnline: false, shutdownState: 'shutdown' }, now)
    expect(pc).toMatchObject({ status: 'shutdown', isShuttingDown: false })
  })

  it('shows a PC the server reports as rebooting with the rebooting status', () => {
    const pc = toRegisteredPc({ ...serverPc, isOnline: false, shutdownState: 'rebooting' }, now)
    expect(pc).toMatchObject({ status: 'rebooting', isRestarting: false })
  })

  it('keeps the online status of a PC that is restarting and flags it', () => {
    const pc = toRegisteredPc(
      {
        ...serverPc,
        isLocked: true,
        shutdownState: 'restarting',
        session: {
          username: 'maria',
          startedAt,
          time: { mode: 'open-time' },
          secondsRemaining: null,
        },
      },
      now,
    )
    expect(pc).toMatchObject({
      status: 'frozen',
      isRestarting: true,
      isShuttingDown: false,
      user: 'maria',
    })
    expect(isPcOnline(pc)).toBe(true)
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

describe('toRegisteredPcs', () => {
  it('keeps the server order, so a newly added PC stays last', () => {
    const input = ['PC-10', 'PC-2', 'PC-1'].map((name, index) => ({ ...serverPc, id: index, name }))
    expect(toRegisteredPcs(input, now).map((pc) => pc.name)).toEqual(['PC-10', 'PC-2', 'PC-1'])
    expect(input.map((pc) => pc.name)).toEqual(['PC-10', 'PC-2', 'PC-1'])
  })

  it('returns an empty list for no PCs', () => {
    expect(toRegisteredPcs([], now)).toEqual([])
  })
})

describe('toRegisteredPc wallpaper', () => {
  it('carries the id of the wallpaper the PC has', () => {
    const pc = toRegisteredPc({ ...serverPc, wallpaper: { id: 4, sha256: 'a'.repeat(64) } }, now)
    expect(pc.wallpaperId).toBe(4)
  })

  it('has no wallpaper when the PC has none', () => {
    expect(toRegisteredPc(serverPc, now).wallpaperId).toBeNull()
  })
})

describe('anyPcHasWallpaper', () => {
  it('is true when at least one PC has a wallpaper', () => {
    expect(anyPcHasWallpaper([{ wallpaperId: null }, { wallpaperId: 3 }])).toBe(true)
  })

  it('is false when no PC has a wallpaper, including PCs that have not reported one', () => {
    expect(anyPcHasWallpaper([{ wallpaperId: null }, {}])).toBe(false)
  })

  it('is false for no PCs', () => {
    expect(anyPcHasWallpaper([])).toBe(false)
  })
})

describe('getPcIdsToKeepAwake', () => {
  const pcs: RegisteredPc[] = [
    { id: 1, name: 'PC-01', status: 'in-use', lastSeen: 'Now' },
    { id: 2, name: 'PC-02', status: 'offline', lastSeen: '1h ago' },
    { id: 3, name: 'PC-03', status: 'locked', lastSeen: 'Now' },
    { id: 4, name: 'PC-04', status: 'shutdown', lastSeen: '2h ago' },
  ]

  it('keeps only the selected PCs that are online when turning it on', () => {
    expect(getPcIdsToKeepAwake(pcs, [1, 2, 4], true)).toEqual([1])
  })

  it('is empty when turning it on and every selected PC is offline', () => {
    expect(getPcIdsToKeepAwake(pcs, [2, 4], true)).toEqual([])
  })

  it('keeps every selected PC that is always awake, offline ones too, when turning it off', () => {
    const awakePcs = pcs.map((pc) => ({ ...pc, keepAwake: true }))
    expect(getPcIdsToKeepAwake(awakePcs, [1, 2, 4], false)).toEqual([1, 2, 4])
  })

  it('leaves out PCs that are already always awake when turning it on', () => {
    const mixedPcs = pcs.map((pc) => ({ ...pc, keepAwake: pc.id === 1 }))
    expect(getPcIdsToKeepAwake(mixedPcs, [1, 3], true)).toEqual([3])
  })

  it('leaves out PCs that are not always awake when turning it off', () => {
    const mixedPcs = pcs.map((pc) => ({ ...pc, keepAwake: pc.id === 1 }))
    expect(getPcIdsToKeepAwake(mixedPcs, [1, 3], false)).toEqual([1])
  })

  it('is empty for both on and off as they match the state of every selected PC', () => {
    const awakePcs = pcs.map((pc) => ({ ...pc, keepAwake: true }))
    expect(getPcIdsToKeepAwake(awakePcs, [1, 3], true)).toEqual([])
    expect(getPcIdsToKeepAwake(pcs, [1, 3], false)).toEqual([])
  })
})

describe('countOfflinePcsToKeepAwake', () => {
  const pcs: RegisteredPc[] = [
    { id: 1, name: 'PC-01', status: 'in-use', lastSeen: 'Now' },
    { id: 2, name: 'PC-02', status: 'offline', lastSeen: '1h ago' },
    { id: 3, name: 'PC-03', status: 'offline', lastSeen: '1h ago', keepAwake: true },
    { id: 4, name: 'PC-04', status: 'shutdown', lastSeen: '2h ago' },
  ]

  it('counts selected offline PCs that are not yet always awake', () => {
    expect(countOfflinePcsToKeepAwake(pcs, [1, 2, 3, 4])).toBe(2)
  })

  it('is zero when the offline PCs are already always awake or not selected', () => {
    expect(countOfflinePcsToKeepAwake(pcs, [1, 3])).toBe(0)
  })
})

describe('describeKeepAwakeResult', () => {
  it('says always awake was turned on for the PCs', () => {
    expect(describeKeepAwakeResult(true, 3, 0)).toBe('Always awake turned on for 3 PCs.')
  })

  it('says always awake was turned off for one PC', () => {
    expect(describeKeepAwakeResult(false, 1, 0)).toBe('Always awake turned off for 1 PC.')
  })

  it('adds how many offline PCs were skipped', () => {
    expect(describeKeepAwakeResult(true, 3, 2)).toBe(
      'Always awake turned on for 3 PCs. 2 offline PCs skipped.',
    )
    expect(describeKeepAwakeResult(true, 3, 1)).toBe(
      'Always awake turned on for 3 PCs. 1 offline PC skipped.',
    )
  })

  it('reports no skipped PCs when turning it off, since offline PCs are included', () => {
    expect(describeKeepAwakeResult(false, 5, 2)).toBe('Always awake turned off for 5 PCs.')
  })
})

describe('describeBulkWallpaperResult', () => {
  it('says the wallpaper was set on the PCs', () => {
    expect(describeBulkWallpaperResult('set', 3)).toBe('Wallpaper set on 3 PCs.')
  })

  it('uses the singular for one PC', () => {
    expect(describeBulkWallpaperResult('set', 1)).toBe('Wallpaper set on 1 PC.')
  })

  it('says no PC got the wallpaper when none was changed', () => {
    expect(describeBulkWallpaperResult('set', 0)).toBe('No PCs got the wallpaper.')
  })

  it('says the wallpaper was removed from the PCs', () => {
    expect(describeBulkWallpaperResult('remove', 2)).toBe('Wallpaper removed from 2 PCs.')
  })

  it('says no PC had a wallpaper to remove when none was changed', () => {
    expect(describeBulkWallpaperResult('remove', 0)).toBe('No PCs had a wallpaper to remove.')
  })
})

describe('formatLastUpdate', () => {
  it('formats the time of day', () => {
    const date = new Date(2026, 10, 5, 10, 44, 12)
    expect(formatLastUpdate(date)).toBe(date.toLocaleTimeString(undefined, { timeStyle: 'medium' }))
  })
})

describe('toRegisteredPc service report', () => {
  const service = { lastSeenAt: '2026-11-05T10:01:00.000Z', clientRunning: false }

  it('carries the service report to the PC', () => {
    expect(toRegisteredPc({ ...serverPc, service }, now).service).toEqual(service)
  })

  it('reads a PC with no service report as null', () => {
    const serverPcWithoutService = { ...serverPc, service: undefined } as unknown as ServerPc
    expect(toRegisteredPc(serverPcWithoutService, now).service).toBeNull()
  })
})

describe('isServiceReportFresh', () => {
  const reportNow = new Date('2026-11-05T10:03:00.000Z')

  it('is true for a report sent within the last 3 minutes', () => {
    expect(isServiceReportFresh('2026-11-05T10:02:00.000Z', reportNow)).toBe(true)
    expect(isServiceReportFresh('2026-11-05T10:00:00.000Z', reportNow)).toBe(true)
  })

  it('is false for a report older than 3 minutes', () => {
    expect(isServiceReportFresh('2026-11-05T09:59:59.000Z', reportNow)).toBe(false)
  })

  it('is false for a timestamp that is not a date', () => {
    expect(isServiceReportFresh('not a date', reportNow)).toBe(false)
  })
})

describe('getServiceWarning', () => {
  const reportNow = new Date('2026-11-05T10:03:00.000Z')
  const freshAt = '2026-11-05T10:02:30.000Z'
  const staleAt = '2026-11-05T09:58:00.000Z'
  const offlinePc = { status: 'offline' as const }
  const onlinePc = { status: 'locked' as const }

  it('warns when the service reports the client is not running on an online PC', () => {
    const pc = { ...onlinePc, service: { lastSeenAt: freshAt, clientRunning: false } }
    expect(getServiceWarning(pc, reportNow)).toBe('Client not running')
  })

  it('warns for an offline PC whose service reported recently', () => {
    const pc = { ...offlinePc, service: { lastSeenAt: freshAt, clientRunning: true } }
    expect(getServiceWarning(pc, reportNow)).toBe('Client not running')
  })

  it('shows no warning for an online PC whose client is running', () => {
    const pc = { ...onlinePc, service: { lastSeenAt: freshAt, clientRunning: true } }
    expect(getServiceWarning(pc, reportNow)).toBeNull()
  })

  it('shows no warning for an offline PC whose service has been silent for over 3 minutes', () => {
    const pc = { ...offlinePc, service: { lastSeenAt: staleAt, clientRunning: false } }
    expect(getServiceWarning(pc, reportNow)).toBeNull()
  })

  it('shows no warning for an online PC whose service report is stale', () => {
    const pc = { ...onlinePc, service: { lastSeenAt: staleAt, clientRunning: false } }
    expect(getServiceWarning(pc, reportNow)).toBeNull()
  })

  it('shows no warning when the PC has no service report', () => {
    expect(getServiceWarning({ ...offlinePc, service: null }, reportNow)).toBeNull()
    expect(getServiceWarning(offlinePc, reportNow)).toBeNull()
  })
})

describe('getPcNumberFromName', () => {
  it('reads the number after the PC- prefix', () => {
    expect(getPcNumberFromName('PC-12')).toBe(12)
    expect(getPcNumberFromName('PC-03')).toBe(3)
    expect(getPcNumberFromName('PC-999999999')).toBe(999_999_999)
  })

  it('returns null for a name with another shape', () => {
    expect(getPcNumberFromName('LAB-12')).toBeNull()
    expect(getPcNumberFromName('PC-')).toBeNull()
    expect(getPcNumberFromName('PC-12a')).toBeNull()
    expect(getPcNumberFromName(' PC-12')).toBeNull()
  })

  it('reads the prefix in any case, as the server does', () => {
    expect(getPcNumberFromName('pc-5')).toBe(5)
    expect(getPcNumberFromName('Pc-7')).toBe(7)
  })

  it('returns null for a number out of range', () => {
    expect(getPcNumberFromName('PC-0')).toBeNull()
    expect(getPcNumberFromName('PC-1000000000')).toBeNull()
  })
})

describe('describeRename', () => {
  it('names the new PC name', () => {
    expect(describeRename('PC-9')).toBe('Renamed to PC-9.')
  })
})
