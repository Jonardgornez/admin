import { z } from 'zod'

export const BACKGROUND_MAX_BYTES = 5 * 1024 * 1024
export const BACKGROUND_CONTENT_TYPES: readonly string[] = ['image/png', 'image/jpeg']
export const BACKGROUND_ACCEPT = BACKGROUND_CONTENT_TYPES.join(',')

const TYPE_MESSAGE = 'Choose a PNG or JPEG image.'
const SIZE_MESSAGE = 'The image must be 5 MB or smaller.'

export const backgroundFileSchema = z
  .instanceof(File, { error: TYPE_MESSAGE })
  .refine((file) => BACKGROUND_CONTENT_TYPES.includes(file.type), {
    error: TYPE_MESSAGE,
    abort: true,
  })
  .refine((file) => file.size <= BACKGROUND_MAX_BYTES, { error: SIZE_MESSAGE })

// Returns the first problem with the file, or null when it can be uploaded.
export function getBackgroundFileError(file: File): string | null {
  const result = backgroundFileSchema.safeParse(file)
  return result.success ? null : result.error.issues[0].message
}
