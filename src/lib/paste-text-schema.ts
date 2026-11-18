import { z } from 'zod'
import { MAX_PASTE_LENGTH, normalizePasteText, PASTE_TOO_LONG_MESSAGE } from './paste-text'

export const PASTE_TEXT_REQUIRED_MESSAGE = 'Enter the text to type on the PC.'

// Checked after normalization, which is what is actually typed. Zod's max() counts code points,
// so the length is checked in UTF-16 code units as the server does.
export const pasteTextSchema = z.object({
  text: z
    .string()
    .transform(normalizePasteText)
    .pipe(
      z
        .string()
        .min(1, PASTE_TEXT_REQUIRED_MESSAGE)
        .refine((text) => text.length <= MAX_PASTE_LENGTH, PASTE_TOO_LONG_MESSAGE),
    ),
})

export type PasteTextInput = z.input<typeof pasteTextSchema>
export type PasteTextValues = z.infer<typeof pasteTextSchema>
