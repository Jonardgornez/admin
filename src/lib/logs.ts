import type { SessionLog } from '../types'

export interface LogFilters {
  from?: string
  to?: string
  pc?: string
  user?: string
}

export interface Page<Item> {
  items: Item[]
  page: number
  totalPages: number
  totalItems: number
  firstItem: number
  lastItem: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function filterLogs(logs: SessionLog[], filters: LogFilters): SessionLog[] {
  const from = filters.from?.trim() ?? ''
  const to = filters.to?.trim() ?? ''
  const pc = filters.pc?.trim().toLowerCase() ?? ''
  const user = filters.user?.trim().toLowerCase() ?? ''

  return logs.filter((log) => {
    const startDate = log.startedAt.slice(0, 10)
    if (from !== '' && startDate < from) return false
    if (to !== '' && startDate > to) return false
    if (pc !== '' && !log.pcName.toLowerCase().includes(pc)) return false
    if (user !== '' && !log.userOrSource.toLowerCase().includes(user)) return false
    return true
  })
}

export function paginate<Item>(items: Item[], page: number, pageSize: number): Page<Item> {
  const totalItems = items.length
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))
  const safePage = Number.isFinite(page) ? Math.min(Math.max(1, Math.floor(page)), totalPages) : 1
  const startIndex = (safePage - 1) * safePageSize
  const pageItems = items.slice(startIndex, startIndex + safePageSize)

  return {
    items: pageItems,
    page: safePage,
    totalPages,
    totalItems,
    firstItem: pageItems.length === 0 ? 0 : startIndex + 1,
    lastItem: pageItems.length === 0 ? 0 : startIndex + pageItems.length,
  }
}

export function formatLogTime(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!match) return iso
  const [, , month, day, hour, minute] = match
  const monthName = MONTH_NAMES[Number(month) - 1]
  if (!monthName) return iso
  return `${day} ${monthName} ${hour}:${minute}`
}

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const remainder = String(total % 60).padStart(2, '0')
  return `${hours}:${remainder}`
}
