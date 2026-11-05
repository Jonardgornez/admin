import type { LoginRequest, LoginRequestStatus } from '../types'
import { formatDefaultTime } from './accounts'

const MS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const NO_VALUE_LABEL = '—'

const DECISION_LABELS: Record<LoginRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
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

export function formatDecision(status: LoginRequestStatus): string {
  return DECISION_LABELS[status]
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
