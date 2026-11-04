import { describe, expect, it } from 'vitest'
import { accounts } from '../data/accounts'
import type { AccountDetails, AccountFormValues } from '../types'
import {
  addAccount,
  deleteAccount,
  filterAccounts,
  toggleAccountEnabled,
  updateAccount,
  validateAccountForm,
} from './accounts'

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

const newDetails: AccountDetails = { username: '  lab-pc09 ', assignedPc: 'PC-09', canUseAnyPc: false }

describe('addAccount', () => {
  it('appends an active account with a trimmed username and no login yet', () => {
    const result = addAccount(accounts, newDetails)
    expect(result).toHaveLength(9)
    expect(result[8]).toEqual({
      username: 'lab-pc09',
      assignedPc: 'PC-09',
      canUseAnyPc: false,
      isActive: true,
      lastLogin: 'Never',
    })
  })

  it('does not mutate the original list', () => {
    addAccount(accounts, newDetails)
    expect(accounts).toHaveLength(8)
  })

  it('never stores a password, even when given form values', () => {
    const values: AccountFormValues = { ...newDetails, password: 'secret' }
    const added = addAccount(accounts, values)[8]
    expect(added).not.toHaveProperty('password')
    expect(JSON.stringify(added)).not.toContain('secret')
  })
})

describe('updateAccount', () => {
  it('updates details with a trimmed username and preserves status and last login', () => {
    const original = accounts.find((a) => a.username === 'lab-pc04')!
    const result = updateAccount(accounts, 'lab-pc04', newDetails)
    expect(result.find((a) => a.username === 'lab-pc09')).toEqual({
      ...original,
      username: 'lab-pc09',
      assignedPc: 'PC-09',
      canUseAnyPc: false,
    })
    expect(result.some((a) => a.username === 'lab-pc04')).toBe(false)
  })

  it('leaves other accounts untouched and does not mutate the original list', () => {
    const snapshot = structuredClone(accounts)
    const result = updateAccount(accounts, 'lab-pc01', newDetails)
    expect(result.filter((a) => a.username !== 'lab-pc09')).toEqual(
      accounts.filter((a) => a.username !== 'lab-pc01'),
    )
    expect(accounts).toEqual(snapshot)
  })

  it('leaves the list equal for an unknown username', () => {
    expect(updateAccount(accounts, 'nobody', newDetails)).toEqual(accounts)
  })

  it('never stores a password, even when given form values', () => {
    const values: AccountFormValues = { ...newDetails, password: 'secret' }
    const result = updateAccount(accounts, 'lab-pc01', values)
    result.forEach((a) => expect(a).not.toHaveProperty('password'))
  })
})

describe('validateAccountForm', () => {
  const valid: AccountFormValues = {
    username: 'lab-pc09',
    assignedPc: 'PC-09',
    canUseAnyPc: false,
    password: 'pass',
  }

  it('returns an empty object for valid values', () => {
    expect(validateAccountForm(valid, accounts)).toEqual({})
  })

  it('requires a username', () => {
    expect(validateAccountForm({ ...valid, username: '   ' }, accounts)).toEqual({
      username: 'Enter a username.',
    })
  })

  it('rejects a username used by another account, case-insensitively and trimmed', () => {
    expect(validateAccountForm({ ...valid, username: ' LAB-PC02 ' }, accounts)).toEqual({
      username: 'That username is already taken.',
    })
  })

  it('requires an assigned PC', () => {
    expect(validateAccountForm({ ...valid, assignedPc: '' }, accounts)).toEqual({
      assignedPc: 'Choose a PC.',
    })
  })

  it('requires a password when adding', () => {
    expect(validateAccountForm({ ...valid, password: '  ' }, accounts)).toEqual({
      password: 'Enter a password.',
    })
  })

  it('reports several errors at once', () => {
    const errors = validateAccountForm(
      { username: '', assignedPc: '', canUseAnyPc: false, password: '' },
      accounts,
    )
    expect(Object.keys(errors).sort()).toEqual(['assignedPc', 'password', 'username'])
  })

  it('allows a blank password when editing', () => {
    expect(validateAccountForm({ ...valid, password: '' }, accounts, 'lab-pc01')).toEqual({})
  })

  it('allows keeping the same username when editing', () => {
    expect(
      validateAccountForm({ ...valid, username: 'lab-pc01', password: '' }, accounts, 'lab-pc01'),
    ).toEqual({})
  })

  it('allows renaming to the same username with different case when editing', () => {
    expect(
      validateAccountForm({ ...valid, username: 'LAB-PC01', password: '' }, accounts, 'lab-pc01'),
    ).toEqual({})
  })

  it('still rejects another account username when editing', () => {
    expect(
      validateAccountForm({ ...valid, username: 'lab-pc02', password: '' }, accounts, 'lab-pc01'),
    ).toEqual({ username: 'That username is already taken.' })
  })
})
