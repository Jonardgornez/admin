import type { SessionLog, SessionLogEndReason } from '../types'

// One page of a longer list, as the server sends it.
export interface PagedList {
  items: readonly unknown[]
  totalItems: number
  page: number
  pageSize: number
}

export interface LogFilters {
  from?: string
  to?: string
  pc?: string
  user?: string
  // An exact match on one PC, set by a PC card's View history link.
  pcId?: number
}

export function formatSessionCount(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'session' : 'sessions'}`
}

export const LOG_PERIOD_KINDS = ['all', 'day', 'month'] as const
export type LogPeriodKind = (typeof LOG_PERIOD_KINDS)[number]

// Day is a date input's value (yyyy-mm-dd) and month a month input's value (yyyy-mm). Only the one the kind names is used.
export interface LogPeriod {
  kind: LogPeriodKind
  day: string
  month: string
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toDayValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toMonthValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function isRealDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

// The From and To days the server filters on, both inclusive. All time, or a blank or invalid day or month, sets no limit.
export function getLogDateRange(period: LogPeriod): Pick<LogFilters, 'from' | 'to'> {
  if (period.kind === 'day' && isRealDay(period.day)) return { from: period.day, to: period.day }
  const match = period.kind === 'month' ? MONTH_PATTERN.exec(period.month) : null
  if (!match) return {}
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return {}
  const lastDay = new Date(year, month, 0).getDate()
  return { from: `${period.month}-01`, to: `${period.month}-${pad(lastDay)}` }
}

// The server's limit on PC names, so a hand-made link can't fill the page.
const MAX_PC_NAME_LENGTH = 64

// A View history link carries the PC's id and name. Anything other than a positive whole id is ignored.
export function readPcFromSearchParams(params: URLSearchParams): { id: number; name: string } | null {
  const rawId = params.get('pcId') ?? ''
  if (!/^[1-9]\d{0,9}$/.test(rawId)) return null
  const id = Number(rawId)
  if (id > 2_147_483_647) return null
  const name = params.get('pcName')?.trim().slice(0, MAX_PC_NAME_LENGTH) || `PC #${id}`
  return { id, name }
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

export function describeEndReason(log: Pick<SessionLog, 'endedAt' | 'endReason'>): string {
  if (log.endedAt === null) return RUNNING_LABEL
  // An ended session with no recorded reason reads as "Other", matching the CSV export.
  return END_REASON_LABELS[log.endReason ?? 'unknown']
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

export function getPageRange({ items, totalItems, page, pageSize }: PagedList): PageRange {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (items.length === 0) return { totalPages, firstItem: 0, lastItem: 0 }
  const firstItem = (page - 1) * pageSize + 1
  return { totalPages, firstItem, lastItem: firstItem + items.length - 1 }
}
