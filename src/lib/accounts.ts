import type { Account, AccountDetails, AccountFormErrors, AccountFormValues } from '../types'

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
  return { username: details.username.trim() }
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

  return errors
}
