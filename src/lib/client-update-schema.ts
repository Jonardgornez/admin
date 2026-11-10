import { z } from 'zod'
import { CLIENT_UPDATE_STATES } from '../types'

export const CLIENT_INSTALLER_MAX_BYTES = 150 * 1024 * 1024
export const CLIENT_INSTALLER_ACCEPT = '.exe'
export const CLIENT_UPDATE_ERROR_MAX_CHARS = 200

const NAME_MESSAGE = 'Choose LykantraSetup.exe.'
const SIZE_MESSAGE = 'The installer must be 150 MB or smaller.'

// Same rule as the server, client and service: each part is 0 or up to 9 digits with no leading zero.
const VERSION_PATTERN = /^(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})$/

export const clientVersionSchema = z.string().regex(VERSION_PATTERN)

export const clientInstallerFileSchema = z
  .instanceof(File, { error: NAME_MESSAGE })
  .refine((file) => file.name.toLowerCase().endsWith(CLIENT_INSTALLER_ACCEPT), {
    error: NAME_MESSAGE,
    abort: true,
  })
  .refine((file) => file.size <= CLIENT_INSTALLER_MAX_BYTES, { error: SIZE_MESSAGE })

// Returns the first problem with the file, or null when it can be uploaded.
export function getClientInstallerFileError(file: File): string | null {
  const result = clientInstallerFileSchema.safeParse(file)
  return result.success ? null : result.error.issues[0].message
}

// Control characters and bidi overrides can hide or reorder text on screen, so they become spaces.
function isUnsafeCharacter(character: string): boolean {
  const code = character.codePointAt(0) ?? 0
  return (
    code <= 0x1f ||
    code === 0x7f ||
    (code >= 0x200e && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  )
}

// Returns text that is safe to show, or null when nothing readable is left.
export function sanitizeClientUpdateError(text: string | null): string | null {
  if (text === null) return null
  const safeText = Array.from(text, (character) =>
    isUnsafeCharacter(character) ? ' ' : character,
  )
    .join('')
    .trim()
  const capped = Array.from(safeText).slice(0, CLIENT_UPDATE_ERROR_MAX_CHARS).join('').trim()
  return capped === '' ? null : capped
}

export const clientUpdateStatusSchema = z.object({
  targetVersion: clientVersionSchema,
  state: z.enum(CLIENT_UPDATE_STATES),
  error: z.string().nullable().transform(sanitizeClientUpdateError),
  // An older server omits this, and a PC with no install-now choice waits for idle.
  installNow: z.boolean().catch(false),
})
