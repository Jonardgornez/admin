import { describe, expect, it } from 'vitest'
import type { SessionLog, SessionLogPage } from '../types'
import { describeEndReason, formatDuration, formatLogTime, getPageRange } from './logs'

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
