import { describe, expect, it } from 'vitest'
import { changePasswordSchema, signInSchema } from './auth-schemas'

function messagesByField(
  result: { error?: { issues: { path: PropertyKey[]; message: string }[] } },
): Record<string, string> {
  return Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))
}

describe('signInSchema', () => {
  it('accepts a username and password', () => {
    expect(signInSchema.safeParse({ username: 'admin', password: 'x' }).success).toBe(true)
  })

  it('requires both fields', () => {
    const messages = messagesByField(signInSchema.safeParse({ username: ' ', password: '' }))
    expect(messages.username).toBeDefined()
    expect(messages.password).toBeDefined()
  })

  it('accepts a 128 character password and rejects 129', () => {
    expect(signInSchema.safeParse({ username: 'a', password: 'x'.repeat(128) }).success).toBe(true)
    expect(signInSchema.safeParse({ username: 'a', password: 'x'.repeat(129) }).success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  const valid = {
    currentPassword: 'old-password',
    newPassword: 'new-password',
    confirmPassword: 'new-password',
  }

  it('accepts valid values', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a new password made only of spaces', () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      newPassword: '        ',
      confirmPassword: '        ',
    })
    expect(messagesByField(result).newPassword).toBe('New password cannot be only spaces.')
  })

  it('rejects a new password shorter than 8 characters', () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      newPassword: 'short',
      confirmPassword: 'short',
    })
    expect(messagesByField(result).newPassword).toBeDefined()
  })

  it('rejects a new password longer than 128 characters', () => {
    const long = 'x'.repeat(129)
    const result = changePasswordSchema.safeParse({
      ...valid,
      newPassword: long,
      confirmPassword: long,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a mismatched confirmation', () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirmPassword: 'different-1' })
    expect(messagesByField(result).confirmPassword).toBe('Passwords do not match.')
  })

  it('rejects a new password equal to the current one', () => {
    const same = {
      currentPassword: 'same-password',
      newPassword: 'same-password',
      confirmPassword: 'same-password',
    }
    expect(messagesByField(changePasswordSchema.safeParse(same)).newPassword).toBeDefined()
  })

  it('requires the current password', () => {
    expect(changePasswordSchema.safeParse({ ...valid, currentPassword: '' }).success).toBe(false)
  })
})
