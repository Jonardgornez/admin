import type { Account, ApprovalChoice, TimeChoiceValues } from '../types'
import type { AccountPayload } from './accounts-api'
import { formatMinutes, parseTimeAmount } from './pcs'

const MINUTES_PER_HOUR = 60
const FALLBACK_TIME_AMOUNT = '60'

export const NEW_ACCOUNT_DEFAULT_TIME: ApprovalChoice = { mode: 'time-limit', minutes: 60 }

export function formatDefaultTime(defaultTime: ApprovalChoice): string {
  return defaultTime.mode === 'open-time' ? 'Open time' : formatMinutes(defaultTime.minutes)
}

export function getDefaultTimeFields(defaultTime: ApprovalChoice): TimeChoiceValues {
  if (defaultTime.mode === 'open-time') {
    return { timeMode: 'open-time', timeAmount: FALLBACK_TIME_AMOUNT, timeUnit: 'minutes' }
  }
  if (defaultTime.minutes % MINUTES_PER_HOUR === 0) {
    return {
      timeMode: 'time-limit',
      timeAmount: String(defaultTime.minutes / MINUTES_PER_HOUR),
      timeUnit: 'hours',
    }
  }
  return { timeMode: 'time-limit', timeAmount: String(defaultTime.minutes), timeUnit: 'minutes' }
}

export function getFormDefaultTime(
  values: TimeChoiceValues,
): ApprovalChoice | null {
  if (values.timeMode === 'open-time') return { mode: 'open-time' }
  const minutes = parseTimeAmount(values.timeAmount, values.timeUnit)
  return minutes === null ? null : { mode: 'time-limit', minutes }
}

export function filterAccounts(accounts: Account[], query: string): Account[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return accounts
  return accounts.filter((account) => account.username.toLowerCase().includes(needle))
}

export function upsertAccount(accounts: Account[], account: Account): Account[] {
  return [...removeAccount(accounts, account.id), account].sort(compareUsernames)
}

export function removeAccount(accounts: Account[], id: number): Account[] {
  return accounts.filter((account) => account.id !== id)
}

function compareUsernames(first: Account, second: Account): number {
  const firstName = first.username.toLowerCase()
  const secondName = second.username.toLowerCase()
  if (firstName === secondName) return 0
  return firstName < secondName ? -1 : 1
}

export function formatLastLogin(lastLoginAt: string | null): string {
  if (lastLoginAt === null) return 'Never'
  const date = new Date(lastLoginAt)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function buildAccountPayload(
  values: TimeChoiceValues & { username: string; password: string },
): AccountPayload | null {
  const defaultTime = getFormDefaultTime(values)
  if (defaultTime === null) return null
  const payload: AccountPayload = { username: values.username, defaultTime }
  if (values.password !== '') payload.password = values.password
  return payload
}
