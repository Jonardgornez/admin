import { describe, expect, it } from 'vitest'
import { uninstallPasswordSchema } from './uninstall-password-schema'

function firstIssue(values: { password: string; confirmPassword: string }) {
  const result = uninstallPasswordSchema.safeParse(values)
  return result.success ? undefined : result.error.issues[0]
}

describe('uninstallPasswordSchema', () => {
  it('accepts matching passwords of 8 to 128 characters', () => {
    expect(firstIssue({ password: 'a'.repeat(8), confirmPassword: 'a'.repeat(8) })).toBeUndefined()
    expect(
      firstIssue({ password: 'a'.repeat(128), confirmPassword: 'a'.repeat(128) }),
    ).toBeUndefined()
  })

  it('rejects a password shorter than 8 characters', () => {
    expect(firstIssue({ password: 'short', confirmPassword: 'short' })?.message).toBe(
      'Password must be at least 8 characters.',
    )
  })

  it('rejects a password longer than 128 characters', () => {
    const long = 'a'.repeat(129)
    expect(firstIssue({ password: long, confirmPassword: long })?.message).toBe(
      'Password must be at most 128 characters.',
    )
  })

  it('rejects passwords that do not match', () => {
    const issue = firstIssue({ password: 'lab-secret-1', confirmPassword: 'lab-secret-2' })
    expect(issue?.message).toBe('Passwords do not match.')
    expect(issue?.path).toEqual(['confirmPassword'])
  })

  it('asks for the confirmation when it is empty', () => {
    expect(firstIssue({ password: 'lab-secret-1', confirmPassword: '' })?.message).toBe(
      'Confirm the password.',
    )
  })
})
