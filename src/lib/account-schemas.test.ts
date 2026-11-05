import { describe, expect, it } from 'vitest'
import {
  addAccountSchema,
  editAccountSchema,
  MAX_ACCOUNT_PASSWORD_LENGTH,
  MAX_TIME_LIMIT_MINUTES,
  MAX_USERNAME_LENGTH,
  MIN_ACCOUNT_PASSWORD_LENGTH,
  PASSWORD_RULE_TEXT,
} from './account-schemas'

const valid = {
  username: 'lab-pc09',
  password: 'longenough',
  timeMode: 'time-limit',
  timeAmount: '60',
  timeUnit: 'minutes',
} as const

function errorsFor(schema: typeof addAccountSchema, values: object) {
  const result = schema.safeParse({ ...valid, ...values })
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    errors[String(issue.path[0])] ??= issue.message
  }
  return errors
}

describe('account schema constants', () => {
  it('match the server rules', () => {
    expect(MAX_USERNAME_LENGTH).toBe(64)
    expect(MIN_ACCOUNT_PASSWORD_LENGTH).toBe(8)
    expect(MAX_ACCOUNT_PASSWORD_LENGTH).toBe(128)
    expect(MAX_TIME_LIMIT_MINUTES).toBe(1440)
  })

  it('states the password rule', () => {
    expect(PASSWORD_RULE_TEXT).toContain('8')
    expect(PASSWORD_RULE_TEXT).toContain('128')
  })
})

describe('username rules', () => {
  it('accepts valid values and trims the result', () => {
    const result = addAccountSchema.safeParse({ ...valid, username: '  Lab_pc.09-x  ' })
    expect(result.success && result.data.username).toBe('Lab_pc.09-x')
  })

  it('requires a username, including a blank one', () => {
    expect(errorsFor(addAccountSchema, { username: '' }).username).toBe('Enter a username.')
    expect(errorsFor(addAccountSchema, { username: '   ' }).username).toBe('Enter a username.')
  })

  it('accepts 64 characters and rejects 65', () => {
    expect(errorsFor(addAccountSchema, { username: 'a'.repeat(64) })).toEqual({})
    expect(errorsFor(addAccountSchema, { username: 'a'.repeat(65) }).username).toMatch(/at most 64/)
  })

  it('rejects spaces and other characters', () => {
    ;['lab pc', 'lab/pc', 'lab@pc', 'labé', 'a\nb'].forEach((username) => {
      expect(errorsFor(addAccountSchema, { username }).username).toMatch(/letters, numbers/)
    })
  })
})

describe('password rules when adding', () => {
  it('requires a password', () => {
    expect(errorsFor(addAccountSchema, { password: '' }).password).toMatch(/at least 8/)
  })

  it('accepts 8 characters and rejects 7', () => {
    expect(errorsFor(addAccountSchema, { password: 'a'.repeat(8) })).toEqual({})
    expect(errorsFor(addAccountSchema, { password: 'a'.repeat(7) }).password).toMatch(/at least 8/)
  })

  it('accepts 128 characters and rejects 129', () => {
    expect(errorsFor(addAccountSchema, { password: 'a'.repeat(128) })).toEqual({})
    expect(errorsFor(addAccountSchema, { password: 'a'.repeat(129) }).password).toMatch(/at most 128/)
  })

  it('rejects a password of only whitespace', () => {
    expect(errorsFor(addAccountSchema, { password: ' '.repeat(10) }).password).toBe(
      'Password cannot be only spaces.',
    )
  })

  it('does not trim the password', () => {
    const result = addAccountSchema.safeParse({ ...valid, password: '  padded pass  ' })
    expect(result.success && result.data.password).toBe('  padded pass  ')
    expect(errorsFor(addAccountSchema, { password: '  abcd  ' })).toEqual({})
  })
})

describe('password rules when editing', () => {
  it('allows a blank password meaning keep', () => {
    expect(errorsFor(editAccountSchema, { password: '' })).toEqual({})
  })

  it('still rejects a short, long or whitespace-only password', () => {
    expect(errorsFor(editAccountSchema, { password: 'short' }).password).toMatch(/at least 8/)
    expect(errorsFor(editAccountSchema, { password: 'a'.repeat(129) }).password).toMatch(/at most 128/)
    expect(errorsFor(editAccountSchema, { password: ' '.repeat(10) }).password).toBe(
      'Password cannot be only spaces.',
    )
  })

  it('accepts a valid new password', () => {
    expect(errorsFor(editAccountSchema, { password: 'new-password' })).toEqual({})
  })
})

describe('default time rules', () => {
  it('rejects a missing or non-whole amount on a time limit, on timeAmount', () => {
    ;['', '0', '-1', '1.5', 'abc'].forEach((timeAmount) => {
      expect(errorsFor(addAccountSchema, { timeAmount }).timeAmount).toBe(
        'Enter a whole number of 1 or more.',
      )
    })
  })

  it('accepts 1 minute and 1440 minutes, rejects 1441', () => {
    expect(errorsFor(addAccountSchema, { timeAmount: '1' })).toEqual({})
    expect(errorsFor(addAccountSchema, { timeAmount: '1440' })).toEqual({})
    expect(errorsFor(addAccountSchema, { timeAmount: '1441' }).timeAmount).toMatch(/24 hours/)
  })

  it('accepts 24 hours and rejects 25 hours', () => {
    expect(errorsFor(addAccountSchema, { timeAmount: '24', timeUnit: 'hours' })).toEqual({})
    expect(
      errorsFor(addAccountSchema, { timeAmount: '25', timeUnit: 'hours' }).timeAmount,
    ).toMatch(/24 hours/)
  })

  it('ignores the amount for open time', () => {
    ;['', 'abc', '0', '999999'].forEach((timeAmount) => {
      expect(errorsFor(addAccountSchema, { timeMode: 'open-time', timeAmount })).toEqual({})
    })
  })

  it('applies to the edit schema too', () => {
    expect(errorsFor(editAccountSchema, { password: '', timeAmount: '25', timeUnit: 'hours' }).timeAmount)
      .toMatch(/24 hours/)
  })

  it('reports field errors together', () => {
    const errors = errorsFor(addAccountSchema, { username: '', password: '', timeAmount: '0' })
    expect(Object.keys(errors).sort()).toEqual(['password', 'timeAmount', 'username'])
  })
})
