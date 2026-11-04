import type {
  Account,
  AccountDetails,
  AccountFormErrors,
  AccountFormValues,
  ApprovalChoice,
} from '../types'
import { formatMinutes, parseTimeAmount } from './pcs'

const MINUTES_PER_HOUR = 60
const FALLBACK_TIME_AMOUNT = '60'

export const NEW_ACCOUNT_DEFAULT_TIME: ApprovalChoice = { mode: 'time-limit', minutes: 60 }

export function formatDefaultTime(defaultTime: ApprovalChoice): string {
  return defaultTime.mode === 'open-time' ? 'Open time' : formatMinutes(defaultTime.minutes)
}

export function getDefaultTimeFields(
  defaultTime: ApprovalChoice,
): Pick<AccountFormValues, 'timeMode' | 'timeAmount' | 'timeUnit'> {
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
  values: Pick<AccountFormValues, 'timeMode' | 'timeAmount' | 'timeUnit'>,
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

export function toggleAccountEnabled(accounts: Account[], username: string): Account[] {
  return accounts.map((account) =>
    account.username === username ? { ...account, isActive: !account.isActive } : account,
  )
}

export function deleteAccount(accounts: Account[], username: string): Account[] {
  return accounts.filter((account) => account.username !== username)
}

function pickDetails(details: AccountDetails): AccountDetails {
  return { username: details.username.trim(), defaultTime: details.defaultTime }
}

export function addAccount(accounts: Account[], details: AccountDetails): Account[] {
  return [...accounts, { ...pickDetails(details), isActive: true, lastLogin: 'Never' }]
}

export function updateAccount(
  accounts: Account[],
  originalUsername: string,
  details: AccountDetails,
): Account[] {
  return accounts.map((account) =>
    account.username === originalUsername ? { ...account, ...pickDetails(details) } : account,
  )
}

export function validateAccountForm(
  values: AccountFormValues,
  accounts: Account[],
  originalUsername?: string,
): AccountFormErrors {
  const errors: AccountFormErrors = {}
  const username = values.username.trim()
  const isEditing = originalUsername !== undefined

  if (username === '') {
    errors.username = 'Enter a username.'
  } else {
    const needle = username.toLowerCase()
    const isTaken = accounts.some(
      (account) =>
        account.username !== originalUsername && account.username.toLowerCase() === needle,
    )
    if (isTaken) errors.username = 'That username is already taken.'
  }

  if (!isEditing && values.password.trim() === '') errors.password = 'Enter a password.'

  if (getFormDefaultTime(values) === null) {
    errors.defaultTime = 'Enter a whole number of 1 or more.'
  }

  return errors
}
