import type { LoginRequest, LoginRequestReason, LoginRequestStatus } from '../types'
import { formatDefaultTime } from './accounts'

const MS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const NO_VALUE_LABEL = '—'

const DECISION_LABELS: Record<LoginRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  cancelled: 'Cancelled',
}

const REASON_LABELS: Record<LoginRequestReason, string> = {
  'pc-offline': 'PC was offline',
  'pc-locked': 'PC was locked',
  'pc-in-use': 'PC was in use',
  'pc-removed': 'PC was removed',
  'pc-unknown': 'Sent by an older client',
  'logged-in': 'Student logged in',
  'cancelled-by-pc': 'Cancelled by the student',
  expired: 'Expired after 10 minutes',
}

function parseTimestamp(timestamp: string): Date | null {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatRequestTime(requestedAt: string): string {
  const date = parseTimestamp(requestedAt)
  return date === null ? 'Unknown' : date.toLocaleTimeString(undefined, { timeStyle: 'short' })
}

export function formatRequestDateTime(timestamp: string | null): string {
  if (timestamp === null) return NO_VALUE_LABEL
  const date = parseTimestamp(timestamp)
  if (date === null) return 'Unknown'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatAgo(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

export function formatRequestedAgo(requestedAt: string, now: Date): string {
  const date = parseTimestamp(requestedAt)
  if (date === null) return 'Unknown'
  // A timestamp ahead of this clock (clock skew) counts as just now.
  const minutes = Math.floor(Math.max(0, now.getTime() - date.getTime()) / MS_PER_MINUTE)
  if (minutes < 1) return 'just now'
  if (minutes < MINUTES_PER_HOUR) return formatAgo(minutes, 'minute')
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  if (hours < HOURS_PER_DAY) return formatAgo(hours, 'hour')
  return formatAgo(Math.floor(hours / HOURS_PER_DAY), 'day')
}

// A plain admin denial has no reason, so it reads just "Denied".
export function formatDecision(request: Pick<LoginRequest, 'status' | 'reason'>): string {
  const label = DECISION_LABELS[request.status]
  return request.reason ? `${label}: ${REASON_LABELS[request.reason]}` : label
}

export function formatLoginRequestsAriaLabel(pendingCount: number): string {
  return `Login requests, ${pendingCount} pending`
}

export function formatTimeGiven(request: Pick<LoginRequest, 'time'>): string {
  return request.time ? formatDefaultTime(request.time) : NO_VALUE_LABEL
}

export function removeRequests(requests: LoginRequest[], ids: number[]): LoginRequest[] {
  return requests.filter((request) => !ids.includes(request.id))
}

export function addToHistory(history: LoginRequest[], entries: LoginRequest[]): LoginRequest[] {
  const entryIds = entries.map((entry) => entry.id)
  return [...entries, ...removeRequests(history, entryIds)]
}

export function describeDenyAll(deniedCount: number): string {
  if (deniedCount === 0) return 'No requests were denied.'
  return `Denied ${deniedCount} ${deniedCount === 1 ? 'request' : 'requests'}.`
}
