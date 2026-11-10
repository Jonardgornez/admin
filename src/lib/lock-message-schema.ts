import { z } from 'zod'

export const MAX_LOCK_MESSAGE_LENGTH = 200
export const DEFAULT_LOCK_MESSAGE = 'This computer has been locked by the administrator.'

// Control characters (newlines included) and unpaired surrogates cannot be shown on a locked PC.
const UNSHOWABLE_CHARACTER = /[\p{Cc}\p{Cs}]/u

function hasUnshowableCharacter(text: string): boolean {
  return UNSHOWABLE_CHARACTER.test(text)
}

// The saved default. It is required, so a blank default is refused.
export const lockScreenMessageSchema = z
  .string()
  .transform((text) => text.trim())
  .pipe(
    z
      .string()
      .min(1, 'Enter the lock screen message.')
      // Zod's max() counts code points, so the length is checked in UTF-16 code units as the server does.
      .refine(
        (text) => text.length <= MAX_LOCK_MESSAGE_LENGTH,
        `The lock screen message must be ${MAX_LOCK_MESSAGE_LENGTH} characters or fewer.`,
      )
      .refine(
        (text) => !hasUnshowableCharacter(text),
        "The lock screen message can't contain a character that can't be shown.",
      ),
  )

// The message typed when locking. It is optional, so an empty message means the default.
export const pcLockMessageSchema = z
  .string()
  .transform((text) => text.trim())
  .pipe(
    z
      .string()
      .refine(
        (text) => text.length <= MAX_LOCK_MESSAGE_LENGTH,
        `The message must be ${MAX_LOCK_MESSAGE_LENGTH} characters or fewer.`,
      )
      .refine(
        (text) => !hasUnshowableCharacter(text),
        "The message can't contain line breaks or control characters.",
      ),
  )

// Null when the text is valid, otherwise the message to show under the field.
export function getPcLockMessageError(text: string): string | null {
  const result = pcLockMessageSchema.safeParse(text)
  return result.success ? null : result.error.issues[0].message
}

// Null means no custom message, so the PC shows the default from Settings.
export function toPcLockMessage(text: string): string | null {
  const trimmed = text.trim()
  return trimmed === '' ? null : trimmed
}
