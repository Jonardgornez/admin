import { describe, expect, it } from 'vitest'
import { accounts } from '../data/accounts'
import type { AccountDetails, AccountFormValues } from '../types'
import {
  addAccount,
  deleteAccount,
  filterAccounts,
  formatDefaultTime,
  getDefaultTimeFields,
  getFormDefaultTime,
  NEW_ACCOUNT_DEFAULT_TIME,
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

const newDetails: AccountDetails = {
  username: '  lab-pc09 ',
  defaultTime: { mode: 'time-limit', minutes: 45 },
}

describe('NEW_ACCOUNT_DEFAULT_TIME', () => {
  it('is a 60 minute time limit', () => {
    expect(NEW_ACCOUNT_DEFAULT_TIME).toEqual({ mode: 'time-limit', minutes: 60 })
  })
})

describe('formatDefaultTime', () => {
  it('labels open time', () => {
    expect(formatDefaultTime({ mode: 'open-time' })).toBe('Open time')
  })

  it('formats a time limit in hours and minutes', () => {
    expect(formatDefaultTime({ mode: 'time-limit', minutes: 30 })).toBe('30m')
    expect(formatDefaultTime({ mode: 'time-limit', minutes: 120 })).toBe('2h')
    expect(formatDefaultTime({ mode: 'time-limit', minutes: 90 })).toBe('1h 30m')
  })
})

describe('getDefaultTimeFields', () => {
  it('shows whole hours in hours', () => {
    expect(getDefaultTimeFields({ mode: 'time-limit', minutes: 120 })).toEqual({
      timeMode: 'time-limit',
      timeAmount: '2',
      timeUnit: 'hours',
    })
  })

  it('shows other amounts in minutes', () => {
    expect(getDefaultTimeFields({ mode: 'time-limit', minutes: 90 })).toEqual({
      timeMode: 'time-limit',
      timeAmount: '90',
      timeUnit: 'minutes',
    })
  })

  it('selects open time and keeps a usable amount for switching back', () => {
    expect(getDefaultTimeFields({ mode: 'open-time' })).toEqual({
      timeMode: 'open-time',
      timeAmount: '60',
      timeUnit: 'minutes',
    })
  })
})

describe('getFormDefaultTime', () => {
  it('converts hours to minutes', () => {
    expect(
      getFormDefaultTime({ timeMode: 'time-limit', timeAmount: '2', timeUnit: 'hours' }),
    ).toEqual({ mode: 'time-limit', minutes: 120 })
  })

  it('returns open time and ignores an invalid amount', () => {
    expect(
      getFormDefaultTime({ timeMode: 'open-time', timeAmount: 'abc', timeUnit: 'minutes' }),
    ).toEqual({ mode: 'open-time' })
  })

  it('returns null for an invalid amount on a time limit', () => {
    ;['', '0', '1.5', '-5', 'abc'].forEach((timeAmount) => {
      expect(
        getFormDefaultTime({ timeMode: 'time-limit', timeAmount, timeUnit: 'minutes' }),
      ).toBeNull()
    })
  })

  it('round-trips with getDefaultTimeFields', () => {
    const choices = [
      { mode: 'time-limit', minutes: 90 },
      { mode: 'time-limit', minutes: 120 },
      { mode: 'open-time' },
    ] as const
    choices.forEach((choice) => {
      expect(getFormDefaultTime(getDefaultTimeFields(choice))).toEqual(choice)
    })
  })
})

describe('addAccount', () => {
  it('appends an active account with a trimmed username and no login yet', () => {
    const result = addAccount(accounts, newDetails)
    expect(result).toHaveLength(9)
    expect(result[8]).toEqual({
      username: 'lab-pc09',
      isActive: true,
      lastLogin: 'Never',
      defaultTime: { mode: 'time-limit', minutes: 45 },
    })
  })

  it('does not mutate the original list', () => {
    addAccount(accounts, newDetails)
    expect(accounts).toHaveLength(8)
  })

  it('never stores a password, even when given form values', () => {
    const values = { ...newDetails, password: 'secret' }
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
      defaultTime: { mode: 'time-limit', minutes: 45 },
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
    const values = { ...newDetails, password: 'secret' }
    const result = updateAccount(accounts, 'lab-pc01', values)
    result.forEach((a) => expect(a).not.toHaveProperty('password'))
  })
})

describe('validateAccountForm', () => {
  const valid: AccountFormValues = {
    username: 'lab-pc09',
    password: 'pass',
    timeMode: 'time-limit',
    timeAmount: '60',
    timeUnit: 'minutes',
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

  it('requires a password when adding', () => {
    expect(validateAccountForm({ ...valid, password: '  ' }, accounts)).toEqual({
      password: 'Enter a password.',
    })
  })

  it('reports several errors at once', () => {
    const errors = validateAccountForm(
      { ...valid, username: '', password: '', timeAmount: '0' },
      accounts,
    )
    expect(Object.keys(errors).sort()).toEqual(['defaultTime', 'password', 'username'])
  })

  it('rejects an invalid time limit', () => {
    expect(validateAccountForm({ ...valid, timeAmount: '1.5' }, accounts)).toEqual({
      defaultTime: 'Enter a whole number of 1 or more.',
    })
  })

  it('ignores the amount for open time', () => {
    expect(
      validateAccountForm({ ...valid, timeMode: 'open-time', timeAmount: '' }, accounts),
    ).toEqual({})
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
