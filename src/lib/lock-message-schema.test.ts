import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCK_MESSAGE,
  getPcLockMessageError,
  lockScreenMessageSchema,
  MAX_LOCK_MESSAGE_LENGTH,
  toPcLockMessage,
} from './lock-message-schema'

const SETTINGS_REQUIRED = 'Enter the lock screen message.'
const SETTINGS_TOO_LONG = 'The lock screen message must be 200 characters or fewer.'
const SETTINGS_UNSHOWABLE = "The lock screen message can't contain a character that can't be shown."
const PC_TOO_LONG = 'The message must be 200 characters or fewer.'
const PC_UNSHOWABLE = "The message can't contain line breaks or control characters."

function settingsIssue(text: string): string | undefined {
  const result = lockScreenMessageSchema.safeParse(text)
  return result.success ? undefined : result.error.issues[0].message
}

describe('lock message constants', () => {
  it('cap a message at 200 characters and default to the built-in text', () => {
    expect(MAX_LOCK_MESSAGE_LENGTH).toBe(200)
    expect(DEFAULT_LOCK_MESSAGE).toBe('This computer has been locked by the administrator.')
  })
})

describe('lockScreenMessageSchema', () => {
  it('accepts a message and trims it', () => {
    expect(lockScreenMessageSchema.parse('  Back at 10:00.  ')).toBe('Back at 10:00.')
  })

  it('accepts exactly 200 characters and rejects 201, counted after trimming', () => {
    expect(settingsIssue('a'.repeat(200))).toBeUndefined()
    expect(settingsIssue(`  ${'a'.repeat(201)}  `)).toBe(SETTINGS_TOO_LONG)
  })

  it('counts UTF-16 code units, so an emoji counts as two characters', () => {
    expect(settingsIssue(`${'a'.repeat(199)}😀`)).toBe(SETTINGS_TOO_LONG)
    expect(settingsIssue(`${'a'.repeat(198)}😀`)).toBeUndefined()
  })

  it.each(['', '   ', '\n\t '])('requires text, refusing %j', (text) => {
    expect(settingsIssue(text)).toBe(SETTINGS_REQUIRED)
  })

  it.each(['line one\nline two', 'tab\there', 'bell\u0007', 'delete\u007f', 'c1\u0085'])(
    'refuses control characters, newlines included: %j',
    (text) => {
      expect(settingsIssue(text)).toBe(SETTINGS_UNSHOWABLE)
    },
  )

  it.each(['lone high \uD83D', 'lone low \uDE00'])('refuses an unpaired surrogate: %j', (text) => {
    expect(settingsIssue(text)).toBe(SETTINGS_UNSHOWABLE)
  })

  it('accepts a paired emoji', () => {
    expect(settingsIssue('Gone for lunch 🍕')).toBeUndefined()
  })
})

describe('getPcLockMessageError', () => {
  it('accepts an empty message, which means the default', () => {
    expect(getPcLockMessageError('')).toBeNull()
    expect(getPcLockMessageError('   ')).toBeNull()
  })

  it('accepts a message of exactly 200 characters', () => {
    expect(getPcLockMessageError('a'.repeat(200))).toBeNull()
  })

  it('rejects a message over 200 characters', () => {
    expect(getPcLockMessageError('a'.repeat(201))).toBe(PC_TOO_LONG)
  })

  it.each(['first\nsecond', 'tab\tinside', 'bell\u0007', 'lone \uD800'])(
    'rejects line breaks and control characters: %j',
    (text) => {
      expect(getPcLockMessageError(text)).toBe(PC_UNSHOWABLE)
    },
  )
})

describe('toPcLockMessage', () => {
  it('returns null for an empty or blank message', () => {
    expect(toPcLockMessage('')).toBeNull()
    expect(toPcLockMessage(' \n ')).toBeNull()
  })

  it('returns the trimmed message', () => {
    expect(toPcLockMessage('  Class is over.  ')).toBe('Class is over.')
  })
})
