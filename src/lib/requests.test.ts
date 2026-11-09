import { describe, expect, it } from 'vitest'
import type { LoginRequest } from '../types'
import {
  addToHistory,
  describeDenyAll,
  formatDecision,
  formatLoginRequestsAriaLabel,
  formatRequestDateTime,
  formatRequestedAgo,
  formatRequestTime,
  formatTimeGiven,
  removeRequests,
} from './requests'

function makeRequest(id: number, overrides: Partial<LoginRequest> = {}): LoginRequest {
  return {
    id,
    pcName: `PC-${id}`,
    requestedAt: '2026-11-05T10:00:00.000Z',
    status: 'pending',
    decidedAt: null,
    ...overrides,
  }
}

const now = new Date('2026-11-05T12:00:00.000Z')
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function agoFrom(offsetMs: number): string {
  return formatRequestedAgo(new Date(now.getTime() - offsetMs).toISOString(), now)
}

describe('formatRequestTime', () => {
  it('formats the local time without the date', () => {
    const iso = new Date(2026, 10, 5, 14, 5).toISOString()
    expect(formatRequestTime(iso)).toBe(
      new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' }),
    )
    expect(formatRequestTime(iso)).toContain('05')
  })

  it('says Unknown for an unreadable timestamp', () => {
    expect(formatRequestTime('not a date')).toBe('Unknown')
  })
})

describe('formatRequestDateTime', () => {
  it('formats the date and time', () => {
    const iso = new Date(2026, 10, 5, 14, 5).toISOString()
    expect(formatRequestDateTime(iso)).toBe(
      new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    )
    expect(formatRequestDateTime(iso)).toContain('2026')
  })

  it('shows a dash for null and Unknown for garbage', () => {
    expect(formatRequestDateTime(null)).toBe('—')
    expect(formatRequestDateTime('nope')).toBe('Unknown')
  })
})

describe('formatRequestedAgo', () => {
  it('says just now under a minute', () => {
    expect(agoFrom(0)).toBe('just now')
    expect(agoFrom(MINUTE - 1)).toBe('just now')
  })

  it('uses singular and plural minutes', () => {
    expect(agoFrom(MINUTE)).toBe('1 minute ago')
    expect(agoFrom(59 * MINUTE)).toBe('59 minutes ago')
  })

  it('uses singular and plural hours', () => {
    expect(agoFrom(HOUR)).toBe('1 hour ago')
    expect(agoFrom(23 * HOUR + 59 * MINUTE)).toBe('23 hours ago')
  })

  it('uses singular and plural days', () => {
    expect(agoFrom(DAY)).toBe('1 day ago')
    expect(agoFrom(3 * DAY)).toBe('3 days ago')
  })

  it('treats a future timestamp as just now', () => {
    expect(agoFrom(-5 * MINUTE)).toBe('just now')
  })

  it('says Unknown for an unreadable timestamp', () => {
    expect(formatRequestedAgo('nope', now)).toBe('Unknown')
  })
})

describe('formatDecision', () => {
  it('labels every status', () => {
    expect(formatDecision({ status: 'approved' })).toBe('Approved')
    expect(formatDecision({ status: 'denied' })).toBe('Denied')
    expect(formatDecision({ status: 'pending' })).toBe('Pending')
    expect(formatDecision({ status: 'cancelled' })).toBe('Cancelled')
  })

  it('says just Denied for a plain admin denial with no reason', () => {
    expect(formatDecision(makeRequest(1, { status: 'denied' }))).toBe('Denied')
  })

  it('adds the reason to a denial', () => {
    expect(formatDecision({ status: 'denied', reason: 'pc-offline' })).toBe(
      'Denied: PC was offline',
    )
    expect(formatDecision({ status: 'denied', reason: 'pc-locked' })).toBe('Denied: PC was locked')
    expect(formatDecision({ status: 'denied', reason: 'pc-in-use' })).toBe('Denied: PC was in use')
    expect(formatDecision({ status: 'denied', reason: 'pc-removed' })).toBe(
      'Denied: PC was removed',
    )
    expect(formatDecision({ status: 'denied', reason: 'pc-unknown' })).toBe(
      'Denied: Sent by an older client',
    )
  })

  it('adds the reason to a cancellation', () => {
    expect(formatDecision({ status: 'cancelled', reason: 'logged-in' })).toBe(
      'Cancelled: Student logged in',
    )
    expect(formatDecision({ status: 'cancelled', reason: 'cancelled-by-pc' })).toBe(
      'Cancelled: Cancelled by the student',
    )
  })

  it('shows just the status when there is no reason', () => {
    expect(formatDecision({ status: 'cancelled', reason: undefined })).toBe('Cancelled')
  })
})

describe('formatLoginRequestsAriaLabel', () => {
  it('names the count of pending requests', () => {
    expect(formatLoginRequestsAriaLabel(3)).toBe('Login requests, 3 pending')
    expect(formatLoginRequestsAriaLabel(1)).toBe('Login requests, 1 pending')
  })
})

describe('formatTimeGiven', () => {
  it('formats a time limit', () => {
    expect(formatTimeGiven({ time: { mode: 'time-limit', minutes: 90 } })).toBe('1h 30m')
  })

  it('formats open time', () => {
    expect(formatTimeGiven({ time: { mode: 'open-time' } })).toBe('Open time')
  })

  it('shows a dash when no time was given', () => {
    expect(formatTimeGiven({})).toBe('—')
  })
})

describe('removeRequests', () => {
  const requests = [makeRequest(1), makeRequest(2), makeRequest(3)]

  it('removes the listed ids and keeps the rest in order', () => {
    expect(removeRequests(requests, [1, 3]).map((request) => request.id)).toEqual([2])
  })

  it('does not change the input', () => {
    removeRequests(requests, [1])
    expect(requests).toHaveLength(3)
  })

  it('ignores ids that are not present', () => {
    expect(removeRequests(requests, [99])).toEqual(requests)
  })
})

describe('addToHistory', () => {
  const older = makeRequest(1, { status: 'denied' })

  it('puts the new entries at the front', () => {
    const added = makeRequest(2, { status: 'approved' })
    expect(addToHistory([older], [added]).map((entry) => entry.id)).toEqual([2, 1])
  })

  it('replaces an entry with the same id instead of duplicating it', () => {
    const updated = makeRequest(1, { status: 'approved' })
    expect(addToHistory([older], [updated])).toEqual([updated])
  })

  it('keeps the order of several new entries', () => {
    const result = addToHistory([older], [makeRequest(3), makeRequest(2)])
    expect(result.map((entry) => entry.id)).toEqual([3, 2, 1])
  })
})

describe('describeDenyAll', () => {
  it('reports none, one and many', () => {
    expect(describeDenyAll(0)).toBe('No requests were denied.')
    expect(describeDenyAll(1)).toBe('Denied 1 request.')
    expect(describeDenyAll(2)).toBe('Denied 2 requests.')
  })
})
