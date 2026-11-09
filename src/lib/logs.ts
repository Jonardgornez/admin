import type { SessionLog, SessionLogEndReason, SessionLogPage } from '../types'

export interface LogFilters {
  from?: string
  to?: string
  pc?: string
  user?: string
}

interface PageRange {
  totalPages: number
  firstItem: number
  lastItem: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const END_REASON_LABELS: Record<SessionLogEndReason, string> = {
  logout: 'Logout',
  'time-expired': 'Time expired',
  'account-disabled': 'Account disabled',
  'account-deleted': 'Account removed',
  replaced: 'Replaced by a new login',
  'pc-removed': 'PC removed',
  'connection-lost': 'Connection lost',
  shutdown: 'Shutdown',
  reboot: 'Reboot',
  unknown: 'Other',
}

const RUNNING_LABEL = 'Running'
const NO_VALUE_LABEL = '—'

export function describeEndReason(log: Pick<SessionLog, 'endedAt' | 'endReason'>): string {
  if (log.endedAt === null) return RUNNING_LABEL
  return log.endReason === null ? NO_VALUE_LABEL : END_REASON_LABELS[log.endReason]
}

// The server sends an ISO string with an offset. Converting it to the browser's time zone gives server time,
// because the server and this console run on the same PC.
export function formatLogTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const day = String(date.getDate()).padStart(2, '0')
  const monthName = MONTH_NAMES[date.getMonth()] ?? ''
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${day} ${monthName} ${hour}:${minute}`
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const remainder = String(total % 60).padStart(2, '0')
  return `${hours}:${remainder}`
}

export function getPageRange({ items, totalItems, page, pageSize }: SessionLogPage): PageRange {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (items.length === 0) return { totalPages, firstItem: 0, lastItem: 0 }
  const firstItem = (page - 1) * pageSize + 1
  return { totalPages, firstItem, lastItem: firstItem + items.length - 1 }
}
