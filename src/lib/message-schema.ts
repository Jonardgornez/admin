import { z } from 'zod'

export const MAX_MESSAGE_LENGTH = 500
export const MAX_MESSAGE_LINES = 10
export const MAX_MESSAGE_RECIPIENTS = 100

// Bidi controls and invisible formatting characters that can disguise a message. ZWJ and ZWNJ
// are left out on purpose, because emoji sequences need ZWJ. Matches the server's list.
const DIRECTION_OR_INVISIBLE_CHARACTERS = new Set([
  0x061c, 0x200b, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2028, 0x2029, 0x2066,
  0x2067, 0x2068, 0x2069, 0xfeff,
])

const NEWLINE = 0x0a
const LAST_CONTROL_CHARACTER = 0x1f
const DELETE_CHARACTER = 0x7f
const LAST_C1_CONTROL_CHARACTER = 0x9f
const HIGH_SURROGATE_START = 0xd800
const HIGH_SURROGATE_END = 0xdbff
const LOW_SURROGATE_START = 0xdc00
const LOW_SURROGATE_END = 0xdfff

function isHighSurrogate(code: number): boolean {
  return code >= HIGH_SURROGATE_START && code <= HIGH_SURROGATE_END
}

function isLowSurrogate(code: number): boolean {
  return code >= LOW_SURROGATE_START && code <= LOW_SURROGATE_END
}

// Newlines are allowed. Other control characters and unpaired surrogates are not.
function hasUnsupportedCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code === NEWLINE) continue
    if (code <= LAST_CONTROL_CHARACTER) return true
    if (code >= DELETE_CHARACTER && code <= LAST_C1_CONTROL_CHARACTER) return true
    if (isHighSurrogate(code)) {
      if (!isLowSurrogate(text.charCodeAt(index + 1))) return true
      index++
    } else if (isLowSurrogate(code)) {
      return true
    }
  }
  return false
}

// Every character in the set is in the Basic Multilingual Plane, so one code unit each is enough.
function hasDirectionOrInvisibleCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    if (DIRECTION_OR_INVISIBLE_CHARACTERS.has(text.charCodeAt(index))) return true
  }
  return false
}

export function countMessageLines(text: string): number {
  return text.split('\n').length
}

// Browsers already send newlines as \n. Normalising here keeps CR out of the payload.
const messageTextSchema = z
  .string()
  .transform((text) => text.replace(/\r\n?/g, '\n').trim())
  .pipe(
    z
      .string()
      .min(1, 'Enter a message.')
      .max(MAX_MESSAGE_LENGTH, `Use ${MAX_MESSAGE_LENGTH} characters or fewer.`)
      .refine(
        (text) => countMessageLines(text) <= MAX_MESSAGE_LINES,
        `Use ${MAX_MESSAGE_LINES} lines or fewer.`,
      )
      .refine(
        (text) => !hasUnsupportedCharacter(text),
        'Remove tabs and other special characters.',
      )
      .refine(
        (text) => !hasDirectionOrInvisibleCharacter(text),
        "The message can't contain direction or invisible formatting characters.",
      ),
  )

export const sendMessageSchema = z.object({
  text: messageTextSchema,
})

export type SendMessageValues = z.infer<typeof sendMessageSchema>
