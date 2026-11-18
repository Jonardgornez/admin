import { z } from 'zod'
import { SHARE_FOLDERS, type ShareFolder } from '../types'

// These rules match the server and the client, so a path the form accepts is one the PC can save.
export const DEFAULT_SHARE_SUBFOLDER = 'Lykantra Share'
export const MAX_SUBFOLDER_SEGMENTS = 3
export const MAX_SUBFOLDER_SEGMENT_LENGTH = 64
export const MAX_SHARE_FILE_NAME_LENGTH = 200

export const CHOOSE_FILE_MESSAGE = 'Choose a file.'
export const INVALID_FILE_NAME_MESSAGE = 'Choose a file with a valid Windows file name.'
export const INVALID_CHARACTER_MESSAGE =
  'Names can\'t contain < > : " | ? *, control or invisible characters.'
export const SHORT_NAME_MESSAGE = 'Names can\'t look like a Windows short name, such as "NAME~1".'

export const SHARE_FOLDER_LABELS: Record<ShareFolder, string> = {
  desktop: 'Desktop',
  documents: 'Documents',
  downloads: 'Downloads',
}

const SEGMENT_SEPARATOR = /[\\/]/
const ROOTED_PATH = /^([\\/]|[a-zA-Z]:)/
const FORBIDDEN_CHARACTERS = /[<>:"|?*]/
const LAST_CONTROL_CHARACTER = 0x1f
const DELETE_CHARACTER = 0x7f
const LAST_C1_CONTROL_CHARACTER = 0x9f
// Unicode format characters such as U+202E and U+200B, and unpaired surrogates.
const INVISIBLE_OR_BROKEN_CHARACTER =
  /\p{Cf}|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u

function hasUnsupportedCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    // C0 controls, then DEL and the C1 controls (U+007F to U+009F).
    if (code <= LAST_CONTROL_CHARACTER) return true
    if (code >= DELETE_CHARACTER && code <= LAST_C1_CONTROL_CHARACTER) return true
  }
  return INVISIBLE_OR_BROKEN_CHARACTER.test(text)
}

// Superscript 1, 2 and 3 count as port digits on Windows too.
const RESERVED_DEVICE_NAME =
  /^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[0-9\u00b9\u00b2\u00b3]|LPT[0-9\u00b9\u00b2\u00b3])$/i
const DESKTOP_INI = 'desktop.ini'
// An 8.3 short name such as PROGRA~1 could point at a different, existing item.
const SHORT_NAME = /^[^.~]{1,6}~[0-9]{1,6}(\.[^.]{1,3})?$/i
const MAX_SHORT_NAME_BASE_LENGTH = 8

// Windows reserves a device name with any extension and ignores spaces before the dot, so "CON .txt" is CON.
// Only spaces are trimmed, as on the server.
function isReservedName(segment: string): boolean {
  const baseName = segment.split('.')[0].replace(/ +$/, '')
  return RESERVED_DEVICE_NAME.test(baseName) || segment.toLowerCase() === DESKTOP_INI
}

function isShortName(segment: string): boolean {
  return SHORT_NAME.test(segment) && segment.split('.')[0].length <= MAX_SHORT_NAME_BASE_LENGTH
}

// Returns why one folder or file name can't be used on Windows, or null when it can.
export function getPathSegmentError(segment: string, maxLength: number): string | null {
  if (segment.length === 0) return 'Remove the empty folder name.'
  if (segment.length > maxLength) return `Keep each name to ${maxLength} characters or fewer.`
  if (segment === '.' || segment === '..') return 'Folder names can\'t be "." or "..".'
  if (FORBIDDEN_CHARACTERS.test(segment) || hasUnsupportedCharacter(segment)) {
    return INVALID_CHARACTER_MESSAGE
  }
  if (segment.endsWith('.') || segment.endsWith(' ')) return "Names can't end with a dot or a space."
  if (segment.startsWith(' ')) return "Names can't start with a space."
  if (isReservedName(segment)) return `"${segment}" is reserved by Windows.`
  if (isShortName(segment)) return SHORT_NAME_MESSAGE
  return null
}

export function splitSubfolder(subfolder: string): string[] {
  return subfolder === '' ? [] : subfolder.split(SEGMENT_SEPARATOR)
}

// Returns why the subfolder can't be used, or null when it can. An empty subfolder saves straight into the folder.
export function getSubfolderError(subfolder: string): string | null {
  if (ROOTED_PATH.test(subfolder)) return 'Enter a folder inside the chosen folder, not a full path.'
  const segments = splitSubfolder(subfolder)
  if (segments.length > MAX_SUBFOLDER_SEGMENTS) {
    return `Use ${MAX_SUBFOLDER_SEGMENTS} folder levels or fewer.`
  }
  for (const segment of segments) {
    const error = getPathSegmentError(segment, MAX_SUBFOLDER_SEGMENT_LENGTH)
    if (error) return error
  }
  return null
}

// Browsers give only the base name, but the last segment is taken anyway, as the server does.
export function getShareFileName(name: string): string {
  return name.split(SEGMENT_SEPARATOR).at(-1) ?? ''
}

export function isValidShareFileName(name: string): boolean {
  return getPathSegmentError(getShareFileName(name), MAX_SHARE_FILE_NAME_LENGTH) === null
}

export function normalizeSubfolder(subfolder: string): string {
  return splitSubfolder(subfolder).join('\\')
}

const subfolderSchema = z
  .string()
  .default(DEFAULT_SHARE_SUBFOLDER)
  .superRefine((subfolder, context) => {
    const error = getSubfolderError(subfolder)
    if (error) context.addIssue({ code: 'custom', message: error })
  })
  .transform(normalizeSubfolder)

export const sendFileSchema = z.object({
  file: z
    .custom<File>((value) => value instanceof File, CHOOSE_FILE_MESSAGE)
    .refine((file) => isValidShareFileName(file.name), INVALID_FILE_NAME_MESSAGE),
  folder: z.enum(SHARE_FOLDERS).default('desktop'),
  subfolder: subfolderSchema,
})

export type SendFileInput = z.input<typeof sendFileSchema>
export type SendFileValues = z.infer<typeof sendFileSchema>

// Shows where the file lands, e.g. "Desktop\Lykantra Share\notes.pdf". Empty names are left out.
export function formatSharePath(folder: ShareFolder, subfolder: string, fileName?: string): string {
  const segments = [SHARE_FOLDER_LABELS[folder], ...splitSubfolder(subfolder), fileName ?? '']
  return segments.filter((segment) => segment !== '').join('\\')
}
