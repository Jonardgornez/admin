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

export function toggleAccountEnabled(accounts: Account[], username: string): Account[] {
  return accounts.map((account) =>
    account.username === username ? { ...account, isActive: !account.isActive } : account,
  )
}

export function deleteAccount(accounts: Account[], username: string): Account[] {
  return accounts.filter((account) => account.username !== username)
}
