import { describe, expect, it } from 'vitest'
import { sessionLogs } from '../data/logs'
import { filterLogs, formatDuration, formatLogTime, paginate } from './logs'

describe('filterLogs', () => {
  it('returns everything for empty filters', () => {
    expect(filterLogs(sessionLogs, {})).toHaveLength(sessionLogs.length)
    expect(filterLogs(sessionLogs, { from: '', to: '', pc: '', user: '' })).toHaveLength(sessionLogs.length)
  })

  it('treats from and to as inclusive dates', () => {
    const result = filterLogs(sessionLogs, { from: '2026-11-03', to: '2026-11-03' })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((log) => log.startedAt.startsWith('2026-11-03'))).toBe(true)
  })

  it('includes both boundary days across a multi-day range and excludes neighbours', () => {
    const make = (id: string, startedAt: string) => ({
      id,
      pcName: 'PC-01',
      userOrSource: 'u',
      startedAt,
      endedAt: null,
      durationMinutes: 0,
      endedBy: null,
    })
    const logs = [
      make('before', '2026-11-01T23:59'),
      make('from-start', '2026-11-02T00:00'),
      make('middle', '2026-11-03T12:00'),
      make('to-end', '2026-11-04T23:59'),
      make('after', '2026-11-05T00:00'),
    ]
    const result = filterLogs(logs, { from: '2026-11-02', to: '2026-11-04' })
    expect(result.map((log) => log.id)).toEqual(['from-start', 'middle', 'to-end'])
  })

  it('supports an open-ended from or to', () => {
    expect(filterLogs(sessionLogs, { from: '2026-11-04' })).toHaveLength(5)
    expect(filterLogs(sessionLogs, { to: '2026-11-01' }).every((log) => log.startedAt < '2026-11-02')).toBe(true)
  })

  it('returns nothing when from is after to', () => {
    expect(filterLogs(sessionLogs, { from: '2026-11-04', to: '2026-11-01' })).toEqual([])
  })

  it('matches pc and user as case-insensitive substrings', () => {
    expect(filterLogs(sessionLogs, { pc: 'pc-05' }).every((log) => log.pcName === 'PC-05')).toBe(true)
    expect(filterLogs(sessionLogs, { user: 'LOGIN' }).every((log) => log.userOrSource === 'Login request')).toBe(true)
  })

  it('combines filters', () => {
    const result = filterLogs(sessionLogs, { pc: 'PC-05', from: '2026-11-04' })
    expect(result.map((log) => log.id)).toEqual(['log-01'])
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1)

  it('returns the first page', () => {
    const result = paginate(items, 1, 10)
    expect(result).toMatchObject({ page: 1, totalPages: 3, totalItems: 25, firstItem: 1, lastItem: 10 })
    expect(result.items).toHaveLength(10)
  })

  it('returns a partial last page', () => {
    const result = paginate(items, 3, 10)
    expect(result).toMatchObject({ page: 3, firstItem: 21, lastItem: 25 })
    expect(result.items).toEqual([21, 22, 23, 24, 25])
  })

  it('clamps out-of-range pages', () => {
    expect(paginate(items, 99, 10).page).toBe(3)
    expect(paginate(items, 0, 10).page).toBe(1)
    expect(paginate(items, -4, 10).page).toBe(1)
    expect(paginate(items, Number.NaN, 10).page).toBe(1)
  })

  it('handles an empty list', () => {
    expect(paginate([], 1, 10)).toEqual({
      items: [],
      page: 1,
      totalPages: 1,
      totalItems: 0,
      firstItem: 0,
      lastItem: 0,
    })
  })

  it('handles an exact multiple of the page size', () => {
    expect(paginate(items.slice(0, 20), 2, 10)).toMatchObject({ totalPages: 2, firstItem: 11, lastItem: 20 })
  })

  it('guards against a non-positive page size', () => {
    expect(paginate([1, 2], 1, 0).totalPages).toBe(2)
  })
})

describe('formatLogTime', () => {
  it('formats an ISO-like local string', () => {
    expect(formatLogTime('2026-11-04T09:30')).toBe('04 Nov 09:30')
    expect(formatLogTime('2026-01-01T00:05')).toBe('01 Jan 00:05')
    expect(formatLogTime('2026-12-31T23:59:30')).toBe('31 Dec 23:59')
  })

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(formatLogTime('Running')).toBe('Running')
    expect(formatLogTime('2026-13-01T10:00')).toBe('2026-13-01T10:00')
  })
})

describe('formatDuration', () => {
  it('formats hours and zero-padded minutes', () => {
    expect(formatDuration(72)).toBe('1:12')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(605)).toBe('10:05')
  })

  it('clamps negative values to zero', () => {
    expect(formatDuration(-3)).toBe('0:00')
  })
})
