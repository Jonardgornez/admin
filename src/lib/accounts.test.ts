import { describe, expect, it } from 'vitest'
import type { Account } from '../types'
import {
  buildAccountPayload,
  filterAccounts,
  formatDefaultTime,
  formatLastLogin,
  getDefaultTimeFields,
  getFormDefaultTime,
  NEW_ACCOUNT_DEFAULT_TIME,
  removeAccount,
  upsertAccount,
} from './accounts'

function makeAccount(id: number, username: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    username,
    isActive: true,
    defaultTime: { mode: 'time-limit', minutes: 60 },
    lastLoginAt: null,
    ...overrides,
  }
}

const accounts: Account[] = [
  makeAccount(1, 'alice'),
  makeAccount(2, 'Bob'),
  makeAccount(3, 'carol'),
  makeAccount(4, 'lab-pc04', { isActive: false }),
]

describe('filterAccounts', () => {
  it('returns all accounts for an empty or blank query', () => {
    expect(filterAccounts(accounts, '')).toHaveLength(4)
    expect(filterAccounts(accounts, '  ')).toHaveLength(4)
  })

  it('matches username case-insensitively', () => {
    expect(filterAccounts(accounts, 'BOB').map((a) => a.username)).toEqual(['Bob'])
  })

  it('matches several accounts by a shared fragment', () => {
    expect(filterAccounts(accounts, 'a').map((a) => a.id)).toEqual([1, 3, 4])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterAccounts(accounts, 'nobody')).toEqual([])
  })
})

describe('upsertAccount', () => {
  it('replaces an existing account by id', () => {
    const updated = makeAccount(3, 'carol', { isActive: false })
    const result = upsertAccount(accounts, updated)
    expect(result).toHaveLength(4)
    expect(result.find((a) => a.id === 3)).toEqual(updated)
  })

  it('moves a renamed account to its new username position', () => {
    const renamed = makeAccount(1, 'zed')
    expect(upsertAccount(accounts, renamed).map((a) => a.username)).toEqual([
      'Bob',
      'carol',
      'lab-pc04',
      'zed',
    ])
  })

  it('inserts a new account in username order, ignoring case', () => {
    const added = makeAccount(9, 'BEN')
    expect(upsertAccount(accounts, added).map((a) => a.username)).toEqual([
      'alice',
      'BEN',
      'Bob',
      'carol',
      'lab-pc04',
    ])
  })

  it('does not mutate the original list', () => {
    const snapshot = structuredClone(accounts)
    upsertAccount(accounts, makeAccount(9, 'aaa'))
    expect(accounts).toEqual(snapshot)
  })
})

describe('removeAccount', () => {
  it('removes only the account with that id', () => {
    expect(removeAccount(accounts, 2).map((a) => a.id)).toEqual([1, 3, 4])
  })

  it('does nothing for an unknown id', () => {
    expect(removeAccount(accounts, 99)).toEqual(accounts)
  })
})

describe('formatLastLogin', () => {
  it('says Never when the account has not signed in', () => {
    expect(formatLastLogin(null)).toBe('Never')
  })

  it('formats a timestamp as a local date and time', () => {
    const text = formatLastLogin('2026-06-15T12:30:00Z')
    expect(text).toContain('2026')
    expect(text).not.toBe('Never')
  })

  it('does not throw on an unreadable timestamp', () => {
    expect(formatLastLogin('not a date')).toBe('Unknown')
  })
})

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

describe('buildAccountPayload', () => {
  const values = {
    username: 'lab-pc09',
    password: 'longenough',
    timeMode: 'time-limit',
    timeAmount: '2',
    timeUnit: 'hours',
  } as const

  it('includes the password and converted default time', () => {
    expect(buildAccountPayload(values)).toEqual({
      username: 'lab-pc09',
      password: 'longenough',
      defaultTime: { mode: 'time-limit', minutes: 120 },
    })
  })

  it('omits the password key when it is blank', () => {
    const payload = buildAccountPayload({ ...values, password: '' })
    expect(payload).toEqual({
      username: 'lab-pc09',
      defaultTime: { mode: 'time-limit', minutes: 120 },
    })
    expect(payload).not.toHaveProperty('password')
  })

  it('keeps a password made of spaces untouched', () => {
    expect(buildAccountPayload({ ...values, password: ' pass word ' })?.password).toBe(' pass word ')
  })

  it('builds open time ignoring the amount', () => {
    expect(buildAccountPayload({ ...values, timeMode: 'open-time', timeAmount: 'x' })).toEqual({
      username: 'lab-pc09',
      password: 'longenough',
      defaultTime: { mode: 'open-time' },
    })
  })

  it('returns null when the time limit is invalid', () => {
    expect(buildAccountPayload({ ...values, timeAmount: '0' })).toBeNull()
  })
})
