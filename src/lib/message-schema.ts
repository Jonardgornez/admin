import { z } from 'zod'

export const MAX_MESSAGE_LENGTH = 500
export const MAX_MESSAGE_LINES = 10

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
      ),
  )

export const sendMessageSchema = z.object({
  text: messageTextSchema,
})

export type SendMessageValues = z.infer<typeof sendMessageSchema>
