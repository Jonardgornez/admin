import { describe, expect, it } from 'vitest'
import { loginRequests } from '../data/requests'
import { buildApprovedEntry, buildDeniedEntry } from './requests'

const request = loginRequests[0]

describe('buildApprovedEntry', () => {
  it('describes a time-limited session using the request time', () => {
    expect(buildApprovedEntry(request, { mode: 'time-limit', minutes: 45 })).toEqual({
      id: 'hist-req-1',
      pcName: 'PC-11',
      requestedAt: '10:43',
      decision: 'Approved',
      session: '45 min, running',
    })
  })

  it('describes an open-time session', () => {
    expect(buildApprovedEntry(request, { mode: 'open-time' }).session).toBe('Open time, running')
  })

  it('falls back to 60 minutes for a non-numeric value and clamps to at least 1', () => {
    expect(buildApprovedEntry(request, { mode: 'time-limit', minutes: Number.NaN }).session).toBe(
      '60 min, running',
    )
    expect(buildApprovedEntry(request, { mode: 'time-limit', minutes: -5 }).session).toBe(
      '1 min, running',
    )
  })

  it('clamps zero to 1 and falls back to 60 for infinite values', () => {
    expect(buildApprovedEntry(request, { mode: 'time-limit', minutes: 0 }).session).toBe(
      '1 min, running',
    )
    expect(
      buildApprovedEntry(request, { mode: 'time-limit', minutes: Number.POSITIVE_INFINITY }).session,
    ).toBe('60 min, running')
  })

  it('rounds fractional minutes', () => {
    expect(buildApprovedEntry(request, { mode: 'time-limit', minutes: 29.6 }).session).toBe(
      '30 min, running',
    )
  })
})

describe('buildDeniedEntry', () => {
  it('records a denial with no session', () => {
    expect(buildDeniedEntry(request)).toEqual({
      id: 'hist-req-1',
      pcName: 'PC-11',
      requestedAt: '10:43',
      decision: 'Denied',
      session: '—',
    })
  })
})
