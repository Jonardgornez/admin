import { describe, expect, it } from 'vitest'
import { accounts } from '../data/accounts'
import { deleteAccount, filterAccounts, toggleAccountEnabled } from './accounts'

describe('filterAccounts', () => {
  it('returns all accounts for an empty or blank query', () => {
    expect(filterAccounts(accounts, '')).toHaveLength(8)
    expect(filterAccounts(accounts, '  ')).toHaveLength(8)
  })

  it('matches username case-insensitively', () => {
    expect(filterAccounts(accounts, 'LAB-PC03').map((a) => a.username)).toEqual(['lab-pc03'])
  })

  it('matches assigned PC', () => {
    expect(filterAccounts(accounts, 'pc-07').map((a) => a.username)).toEqual(['lab-pc07'])
  })

  it('matches several accounts by a shared fragment', () => {
    expect(filterAccounts(accounts, 'lab-pc0')).toHaveLength(8)
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterAccounts(accounts, 'nobody')).toEqual([])
  })
})

describe('toggleAccountEnabled', () => {
  it('disables an active account and enables a disabled one', () => {
    const disabled = toggleAccountEnabled(accounts, 'lab-pc01')
    expect(disabled.find((a) => a.username === 'lab-pc01')?.isActive).toBe(false)
    const enabled = toggleAccountEnabled(accounts, 'lab-pc04')
    expect(enabled.find((a) => a.username === 'lab-pc04')?.isActive).toBe(true)
  })

  it('leaves other accounts and the original list untouched', () => {
    const result = toggleAccountEnabled(accounts, 'lab-pc01')
    expect(result.filter((a) => a.username !== 'lab-pc01')).toEqual(
      accounts.filter((a) => a.username !== 'lab-pc01'),
    )
    expect(accounts[0].isActive).toBe(true)
  })

  it('does nothing for an unknown username', () => {
    expect(toggleAccountEnabled(accounts, 'nobody')).toEqual(accounts)
  })
})

describe('deleteAccount', () => {
  it('removes only the matching account', () => {
    const result = deleteAccount(accounts, 'lab-pc03')
    expect(result).toHaveLength(7)
    expect(result.some((a) => a.username === 'lab-pc03')).toBe(false)
  })

  it('does nothing for an unknown username', () => {
    expect(deleteAccount(accounts, 'nobody')).toHaveLength(8)
  })
})
