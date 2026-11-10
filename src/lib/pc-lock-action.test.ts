import { describe, expect, it } from 'vitest'
import { getLockActionPcIds, type LockAction } from './pc-lock-action'
import type { RegisteredPc } from '../types'

const pc: RegisteredPc = { id: 3, name: 'PC-03', status: 'in-use', lastSeen: 'Now' }
const singleLock: LockAction = { kind: 'lock', pc }
const bulkLock: LockAction = { kind: 'lock', pcIds: [1, 2, 3] }
const bulkUnlock: LockAction = { kind: 'unlock', pcIds: [1, 2] }

describe('getLockActionPcIds', () => {
  it('returns the id of the one PC for a single lock', () => {
    expect(getLockActionPcIds(singleLock)).toEqual([3])
  })

  it('returns the selected ids for a bulk action', () => {
    expect(getLockActionPcIds(bulkLock)).toEqual([1, 2, 3])
    expect(getLockActionPcIds(bulkUnlock)).toEqual([1, 2])
  })
})
