import type { ApiResult } from './api'
import { NO_REPORT_MESSAGE, NO_REPORT_STATUS } from './diagnostics-api'
import type {
  DiagnosticsEvent,
  DiagnosticsUpdate,
  DiagnosticsUpdateState,
  PcDiagnostics,
} from '../types'

// The first client version that sends health reports. The empty state names it.
export const DIAGNOSTICS_MIN_CLIENT_VERSION = '0.23.0'
export const DIAGNOSTICS_EMPTY_TEXT = `${NO_REPORT_MESSAGE} It needs client ${DIAGNOSTICS_MIN_CLIENT_VERSION} or newer.`

export type PcDiagnosticsState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'loaded'; report: PcDiagnostics; now: Date }
  | { status: 'error'; error: string }

// A failed poll keeps the last report on screen, and the next poll tries again.
export function nextDiagnosticsState(
  current: PcDiagnosticsState,
  result: ApiResult<PcDiagnostics>,
  now: Date,
): PcDiagnosticsState {
  if (result.success) return { status: 'loaded', report: result.data, now }
  if (result.status === NO_REPORT_STATUS && result.error === NO_REPORT_MESSAGE) {
    return { status: 'empty' }
  }
  if (current.status === 'loaded') return current
  return { status: 'error', error: result.error }
}

const UPDATE_STATE_LABELS: Record<DiagnosticsUpdateState, string> = {
  pending: 'Queued',
  waiting: 'Waiting until the PC is free',
  downloading: 'Downloading',
  installing: 'Installing',
  failed: 'Failed',
}

export function getUpdateStatusLabel(update: DiagnosticsUpdate): string {
  return `Update ${update.version}: ${UPDATE_STATE_LABELS[update.state]}`
}

function getEventTime(event: DiagnosticsEvent): number {
  const time = new Date(event.at).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function sortEventsNewestFirst(events: DiagnosticsEvent[]): DiagnosticsEvent[] {
  return [...events].sort((first, second) => getEventTime(second) - getEventTime(first))
}
