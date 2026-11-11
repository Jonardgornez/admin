import { describe, expect, it } from 'vitest'
import type { ApiResult } from './api'
import { NO_REPORT_MESSAGE } from './diagnostics-api'
import {
  DIAGNOSTICS_EMPTY_TEXT,
  getUpdateStatusLabel,
  nextDiagnosticsState,
  sortEventsNewestFirst,
  type PcDiagnosticsState,
} from './diagnostics'
import type { DiagnosticsEvent, PcDiagnostics } from '../types'

const now = new Date('2026-11-05T10:05:00.000Z')
const NETWORK_ERROR_TEXT = "Can't reach the server. Check that it's running."

const report: PcDiagnostics = {
  receivedAt: '2026-11-05T10:04:00.000Z',
  serviceVersion: '0.23.0',
  clientRunning: true,
  clientVersion: '0.23.0',
  userSignedIn: false,
  update: null,
  events: [],
}

const loadedState: PcDiagnosticsState = { status: 'loaded', report, now }
const success: ApiResult<PcDiagnostics> = { success: true, data: report }
const noReport: ApiResult<PcDiagnostics> = {
  success: false,
  status: 404,
  error: NO_REPORT_MESSAGE,
}
const networkFailure: ApiResult<PcDiagnostics> = {
  success: false,
  status: 0,
  error: NETWORK_ERROR_TEXT,
}

describe('nextDiagnosticsState', () => {
  it('shows the report when a read succeeds', () => {
    expect(nextDiagnosticsState({ status: 'loading' }, success, now)).toEqual(loadedState)
  })

  it('shows the empty state for the no-report 404', () => {
    expect(nextDiagnosticsState({ status: 'loading' }, noReport, now)).toEqual({ status: 'empty' })
  })

  it('shows an error when the first read fails', () => {
    expect(nextDiagnosticsState({ status: 'loading' }, networkFailure, now)).toEqual({
      status: 'error',
      error: NETWORK_ERROR_TEXT,
    })
  })

  it('keeps the last report on screen when a later poll fails', () => {
    expect(nextDiagnosticsState(loadedState, networkFailure, now)).toBe(loadedState)
  })

  it('replaces the empty state once a report arrives', () => {
    expect(nextDiagnosticsState({ status: 'empty' }, success, now)).toEqual(loadedState)
  })
})

describe('DIAGNOSTICS_EMPTY_TEXT', () => {
  it('says the PC needs client 0.23.0 or newer', () => {
    expect(DIAGNOSTICS_EMPTY_TEXT).toBe(
      'No report from this PC yet. It needs client 0.23.0 or newer.',
    )
  })
})

describe('getUpdateStatusLabel', () => {
  it('names the version and the state of the update', () => {
    expect(getUpdateStatusLabel({ version: '0.23.0', state: 'downloading', error: null })).toBe(
      'Update 0.23.0: Downloading',
    )
  })

  it('says an update waits until the PC is free', () => {
    expect(getUpdateStatusLabel({ version: '0.23.0', state: 'waiting', error: null })).toBe(
      'Update 0.23.0: Waiting until the PC is free',
    )
  })
})

describe('sortEventsNewestFirst', () => {
  const event = (at: string, message: string): DiagnosticsEvent => ({
    at,
    level: 'information',
    message,
  })

  it('puts the latest event first', () => {
    const events = [
      event('2026-11-05T10:00:00.000Z', 'old'),
      event('2026-11-05T10:03:00.000Z', 'new'),
      event('2026-11-05T10:01:00.000Z', 'middle'),
    ]
    expect(sortEventsNewestFirst(events).map((item) => item.message)).toEqual([
      'new',
      'middle',
      'old',
    ])
  })

  it('does not change the order it was given', () => {
    const events = [
      event('2026-11-05T10:00:00.000Z', 'a'),
      event('2026-11-05T10:01:00.000Z', 'b'),
    ]
    sortEventsNewestFirst(events)
    expect(events.map((item) => item.message)).toEqual(['a', 'b'])
  })

  it('puts an event with an unreadable time last', () => {
    const events = [event('not a date', 'broken'), event('2026-11-05T10:00:00.000Z', 'ok')]
    expect(sortEventsNewestFirst(events).map((item) => item.message)).toEqual(['ok', 'broken'])
  })
})
