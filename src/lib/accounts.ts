import type { Account } from '../types'

export function filterAccounts(accounts: Account[], query: string): Account[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return accounts
  return accounts.filter(
    (account) =>
      account.username.toLowerCase().includes(needle) ||
      account.assignedPc.toLowerCase().includes(needle),
  )
}
