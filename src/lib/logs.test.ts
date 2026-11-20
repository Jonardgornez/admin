import { describe, expect, it } from 'vitest'
import type { SessionLog, SessionLogPage } from '../types'
import {
  describeEndReason,
  formatDuration,
  formatLogTime,
  formatSessionCount,
  getLogDateRange,
  getPageRange,
  readPcFromSearchParams,
  toDayValue,
  toMonthValue,
  type LogPeriod,
} from './logs'

describe('getLogDateRange', () => {
  const period = (change: Partial<LogPeriod>): LogPeriod => ({
    kind: 'all',
    day: '2026-11-20',
    month: '2026-11',
    ...change,
  })

  it('sets no limit for all time', () => {
    expect(getLogDateRange(period({ kind: 'all' }))).toEqual({})
  })

  it('uses the chosen day as both ends', () => {
    expect(getLogDateRange(period({ kind: 'day', day: '2026-11-08' }))).toEqual({
      from: '2026-11-08',
      to: '2026-11-08',
    })
  })

  it.each([
    ['2026-11', '2026-11-01', '2026-11-30'],
    ['2026-02', '2026-02-01', '2026-02-28'],
    ['2028-02', '2028-02-01', '2028-02-29'],
    ['2026-12', '2026-12-01', '2026-12-31'],
  ])('covers the whole of %s', (month, from, to) => {
    expect(getLogDateRange(period({ kind: 'month', month }))).toEqual({ from, to })
  })

  it.each([
    { kind: 'day', day: '' },
    { kind: 'day', day: '2026-02-30' },
    { kind: 'day', day: '08/11/2026' },
    { kind: 'month', month: '' },
    { kind: 'month', month: '2026-13' },
    { kind: 'month', month: '2026-1' },
  ] as const)('sets no limit for a blank or invalid value: %o', (change) => {
    expect(getLogDateRange(period(change))).toEqual({})
  })
})

describe('toDayValue and toMonthValue', () => {
  it('format a local date for the date and month pickers', () => {
    const date = new Date(2026, 0, 5)
    expect(toDayValue(date)).toBe('2026-01-05')
    expect(toMonthValue(date)).toBe('2026-01')
  })
})

describe('formatSessionCount', () => {
  it('counts sessions with grouping', () => {
    expect(formatSessionCount(1)).toBe('1 session')
    expect(formatSessionCount(1234)).toBe('1,234 sessions')
  })
})

describe('readPcFromSearchParams', () => {
  const read = (search: string) => readPcFromSearchParams(new URLSearchParams(search))

  it('reads the PC id and name', () => {
    expect(read('pcId=3&pcName=PC-3')).toEqual({ id: 3, name: 'PC-3' })
  })

  it('names the PC by its id when no name is given', () => {
    expect(read('pcId=3')).toEqual({ id: 3, name: 'PC #3' })
    expect(read('pcId=3&pcName=%20')).toEqual({ id: 3, name: 'PC #3' })
  })

  it('cuts a name longer than 64 characters', () => {
    expect(read(`pcId=3&pcName=${'x'.repeat(80)}`)?.name).toBe('x'.repeat(64))
  })

  it.each(['', 'pcName=PC-3', 'pcId=0', 'pcId=-1', 'pcId=1.5', 'pcId=abc', 'pcId=01', 'pcId=2147483648'])(
    'ignores %s',
    (search) => {
      expect(read(search)).toBeNull()
    },
  )
})

function makeLog(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 1,
    pcName: 'PC-01',
    userOrSource: 'lab-pc01',
    source: 'account',
    startedAt: '2026-11-04T09:30:00.000Z',
    endedAt: '2026-11-04T10:00:00.000Z',
    durationMinutes: 30,
    endReason: 'logout',
    ...overrides,
  }
}

function makePage(overrides: Partial<SessionLogPage> = {}): SessionLogPage {
  return { items: [makeLog()], totalItems: 1, page: 1, pageSize: 10, ...overrides }
}

describe('describeEndReason', () => {
  it.each([
    ['logout', 'Logout'],
    ['time-expired', 'Time expired'],
    ['account-disabled', 'Account disabled'],
    ['account-deleted', 'Account removed'],
    ['replaced', 'Replaced by a new login'],
    ['pc-removed', 'PC removed'],
    ['connection-lost', 'Connection lost'],
    ['shutdown', 'Shutdown'],
    ['reboot', 'Reboot'],
    ['unknown', 'Other'],
  ] as const)('labels %s as %s', (endReason, label) => {
    expect(describeEndReason(makeLog({ endReason }))).toBe(label)
  })

  it('shows Running for a session that has not ended', () => {
    expect(describeEndReason(makeLog({ endedAt: null, endReason: null }))).toBe('Running')
  })

  it('shows Other for an ended session with no reason, matching the CSV export', () => {
    expect(describeEndReason(makeLog({ endReason: null }))).toBe('Other')
  })
})

describe('formatLogTime', () => {
  it('shows an offset ISO string in the local time zone', () => {
    const local = new Date(2026, 10, 4, 9, 30)
    expect(formatLogTime(local.toISOString())).toBe('04 Nov 09:30')
  })

  it('formats a local ISO string without an offset', () => {
    expect(formatLogTime(new Date(2026, 0, 1, 0, 5).toISOString())).toBe('01 Jan 00:05')
    expect(formatLogTime(new Date(2026, 11, 31, 23, 59).toISOString())).toBe('31 Dec 23:59')
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

describe('getPageRange', () => {
  it('counts the rows shown on a full first page', () => {
    const items = Array.from({ length: 10 }, (_, index) => makeLog({ id: index + 1 }))
    expect(getPageRange(makePage({ items, totalItems: 25, page: 1 }))).toEqual({
      totalPages: 3,
      firstItem: 1,
      lastItem: 10,
    })
  })

  it('counts a partial last page from its offset', () => {
    const items = Array.from({ length: 5 }, (_, index) => makeLog({ id: index + 1 }))
    expect(getPageRange(makePage({ items, totalItems: 25, page: 3 }))).toEqual({
      totalPages: 3,
      firstItem: 21,
      lastItem: 25,
    })
  })

  it('has one page and a zero range when there are no sessions', () => {
    expect(getPageRange(makePage({ items: [], totalItems: 0, page: 1 }))).toEqual({
      totalPages: 1,
      firstItem: 0,
      lastItem: 0,
    })
  })

  it('treats an exact multiple of the page size as full pages', () => {
    const items = Array.from({ length: 10 }, (_, index) => makeLog({ id: index + 1 }))
    expect(getPageRange(makePage({ items, totalItems: 20, page: 2 }))).toEqual({
      totalPages: 2,
      firstItem: 11,
      lastItem: 20,
    })
  })
})
