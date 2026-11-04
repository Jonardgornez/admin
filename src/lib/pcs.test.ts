import { describe, expect, it } from 'vitest'
import { pcs } from '../data/pcs'
import type { Pc } from '../types'
import { countOnlinePcs, filterPcs, isPcOff } from './pcs'

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
