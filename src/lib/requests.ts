import type { ApprovalChoice, LoginRequest, RequestHistoryEntry } from '../types'

const DEFAULT_MINUTES = 60

function normalizeMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_MINUTES
  return Math.max(1, Math.round(minutes))
}

function describeSession(approval: ApprovalChoice): string {
  if (approval.mode === 'open-time') return 'Open time, running'
  return `${normalizeMinutes(approval.minutes)} min, running`
}

export function buildApprovedEntry(
  request: LoginRequest,
  approval: ApprovalChoice,
): RequestHistoryEntry {
  return {
    id: `hist-${request.id}`,
    pcName: request.pcName,
    requestedAt: request.requestedAt,
    decision: 'Approved',
    session: describeSession(approval),
  }
}

export function buildDeniedEntry(request: LoginRequest): RequestHistoryEntry {
  return {
    id: `hist-${request.id}`,
    pcName: request.pcName,
    requestedAt: request.requestedAt,
    decision: 'Denied',
    session: '—',
  }
}
