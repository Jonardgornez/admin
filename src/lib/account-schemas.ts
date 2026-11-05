import { z } from 'zod'
import { getFormDefaultTime } from './accounts'

export const MAX_USERNAME_LENGTH = 64
export const MIN_ACCOUNT_PASSWORD_LENGTH = 8
export const MAX_ACCOUNT_PASSWORD_LENGTH = 128
export const MAX_TIME_LIMIT_MINUTES = 1440

export const USERNAME_RULE_MESSAGE = 'Use only letters, numbers, dots, underscores and hyphens.'
export const PASSWORD_RULE_TEXT = `${MIN_ACCOUNT_PASSWORD_LENGTH} to ${MAX_ACCOUNT_PASSWORD_LENGTH} characters, not only spaces.`

function getPasswordError(password: string): string | undefined {
  if (password.length < MIN_ACCOUNT_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_ACCOUNT_PASSWORD_LENGTH} characters.`
  }
  if (password.length > MAX_ACCOUNT_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_ACCOUNT_PASSWORD_LENGTH} characters.`
  }
  if (password.trim().length === 0) return 'Password cannot be only spaces.'
  return undefined
}

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/

const usernameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a username.')
  .max(MAX_USERNAME_LENGTH, `Username must be at most ${MAX_USERNAME_LENGTH} characters.`)
  .regex(USERNAME_PATTERN, USERNAME_RULE_MESSAGE)

// Passwords are never trimmed: spaces are part of the password. A blank password
// on edit means keep the current one.
function passwordSchema(isBlankAllowed: boolean) {
  return z.string().superRefine((value, context) => {
    if (isBlankAllowed && value === '') return
    const message = getPasswordError(value)
    if (message) context.addIssue({ code: 'custom', message })
  })
}

const timeFieldsShape = {
  timeMode: z.enum(['time-limit', 'open-time']),
  timeAmount: z.string(),
  timeUnit: z.enum(['minutes', 'hours']),
}

function buildAccountSchema(isPasswordOptional: boolean) {
  return z
    .object({
      username: usernameSchema,
      password: passwordSchema(isPasswordOptional),
      ...timeFieldsShape,
    })
    .superRefine((values, context) => {
      if (values.timeMode !== 'time-limit') return
      const defaultTime = getFormDefaultTime(values)
      if (defaultTime === null) {
        context.addIssue({
          code: 'custom',
          path: ['timeAmount'],
          message: 'Enter a whole number of 1 or more.',
        })
      } else if (defaultTime.mode === 'time-limit' && defaultTime.minutes > MAX_TIME_LIMIT_MINUTES) {
        context.addIssue({
          code: 'custom',
          path: ['timeAmount'],
          message: 'Time limit can be at most 24 hours.',
        })
      }
    })
}

export const addAccountSchema = buildAccountSchema(false)
export const editAccountSchema = buildAccountSchema(true)

export type AccountFormValues = z.infer<typeof addAccountSchema>
