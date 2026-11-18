import { describe, expect, it } from 'vitest'
import {
  CHOOSE_FILE_MESSAGE,
  formatSharePath,
  getPathSegmentError,
  getShareFileName,
  getSubfolderError,
  INVALID_CHARACTER_MESSAGE,
  INVALID_FILE_NAME_MESSAGE,
  isValidShareFileName,
  normalizeSubfolder,
  sendFileSchema,
  SHORT_NAME_MESSAGE,
  splitSubfolder,
} from './send-file-schema'

const notes = new File(['hello'], 'notes.pdf')

function firstMessage(input: unknown): string | undefined {
  const result = sendFileSchema.safeParse(input)
  return result.success ? undefined : result.error.issues[0]?.message
}

describe('getPathSegmentError', () => {
  it('accepts an ordinary name', () => {
    expect(getPathSegmentError('Class 3B', 64)).toBeNull()
  })

  it.each([
    ['', 'Remove the empty folder name.'],
    ['.', 'Folder names can\'t be "." or "..".'],
    ['..', 'Folder names can\'t be "." or "..".'],
    ['a<b', INVALID_CHARACTER_MESSAGE],
    ['what?', INVALID_CHARACTER_MESSAGE],
    ['tab\there', INVALID_CHARACTER_MESSAGE],
    ['del\u007fhere', INVALID_CHARACTER_MESSAGE],
    ['evil\u202Efdp.exe', INVALID_CHARACTER_MESSAGE],
    ['zero\u200Bwidth', INVALID_CHARACTER_MESSAGE],
    ['c1\u0085control', INVALID_CHARACTER_MESSAGE],
    ['c1\u009fcontrol', INVALID_CHARACTER_MESSAGE],
    ['lone\uD800high', INVALID_CHARACTER_MESSAGE],
    ['lone\uDC00low', INVALID_CHARACTER_MESSAGE],
    ['CONIN$', '"CONIN$" is reserved by Windows.'],
    ['conout$.log', '"conout$.log" is reserved by Windows.'],
    ['COM\u00b9', '"COM\u00b9" is reserved by Windows.'],
    ['com\u00b2.txt', '"com\u00b2.txt" is reserved by Windows.'],
    ['LPT\u00b3', '"LPT\u00b3" is reserved by Windows.'],
    ['COM0', '"COM0" is reserved by Windows.'],
    ['lpt0.txt', '"lpt0.txt" is reserved by Windows.'],
    ['CON .txt', '"CON .txt" is reserved by Windows.'],
    ['Desktop.INI', '"Desktop.INI" is reserved by Windows.'],
    ['PROGRA~1', SHORT_NAME_MESSAGE],
    ['NOTES~12.PDF', SHORT_NAME_MESSAGE],
    ['REPORT~1.PDF', SHORT_NAME_MESSAGE],
    ['LYKANT~1', SHORT_NAME_MESSAGE],
    ['AB~12.TXT', SHORT_NAME_MESSAGE],
    ['ends.', "Names can't end with a dot or a space."],
    ['ends ', "Names can't end with a dot or a space."],
    [' starts', "Names can't start with a space."],
    ['CON', '"CON" is reserved by Windows.'],
    ['com1.txt', '"com1.txt" is reserved by Windows.'],
    ['Lpt9', '"Lpt9" is reserved by Windows.'],
  ])('refuses %j', (segment, message) => {
    expect(getPathSegmentError(segment, 64)).toBe(message)
  })

  it('refuses a name over the length limit', () => {
    expect(getPathSegmentError('a'.repeat(65), 64)).toBe('Keep each name to 64 characters or fewer.')
    expect(getPathSegmentError('a'.repeat(64), 64)).toBeNull()
  })

  it('does not treat a longer name that starts like a device as reserved', () => {
    expect(getPathSegmentError('CONSOLE', 64)).toBeNull()
    expect(getPathSegmentError('COM10', 64)).toBeNull()
    expect(getPathSegmentError('CONIN', 64)).toBeNull()
    expect(getPathSegmentError('COM\u2074', 64)).toBeNull()
  })

  it('allows emoji made of paired surrogates and a tilde not followed by digits', () => {
    expect(getPathSegmentError('photos \u{1F600}', 64)).toBeNull()
    expect(getPathSegmentError('notes~draft.txt', 64)).toBeNull()
    expect(getPathSegmentError('a~1b.txt', 64)).toBeNull()
  })

  it('allows tilde names that are not 8.3 short names', () => {
    expect(getPathSegmentError('backup~2024.zip', 64)).toBeNull()
    expect(getPathSegmentError('my~file.txt', 64)).toBeNull()
    expect(getPathSegmentError('verylong~1.txt', 64)).toBeNull()
    expect(getPathSegmentError('AB~1.TEXT', 64)).toBeNull()
  })

  it('trims only spaces before the dot when checking device names', () => {
    expect(getPathSegmentError('CON  .txt', 64)).toBe('"CON  .txt" is reserved by Windows.')
    expect(getPathSegmentError('CON\u00a0.txt', 64)).toBeNull()
  })

  it('refuses desktop.ini only as the whole name', () => {
    expect(getPathSegmentError('my desktop.ini notes', 64)).toBeNull()
  })
})

describe('splitSubfolder', () => {
  it('splits on both slash kinds and gives no segments for an empty subfolder', () => {
    expect(splitSubfolder('a/b\\c')).toEqual(['a', 'b', 'c'])
    expect(splitSubfolder('')).toEqual([])
  })
})

describe('getSubfolderError', () => {
  it('accepts empty and up to three levels', () => {
    expect(getSubfolderError('')).toBeNull()
    expect(getSubfolderError('a\\b/c')).toBeNull()
  })

  it('refuses more than three levels', () => {
    expect(getSubfolderError('a\\b\\c\\d')).toBe('Use 3 folder levels or fewer.')
  })

  it.each(['\\share', '/share', 'C:\\share', 'c:share'])('refuses the rooted path %j', (path) => {
    expect(getSubfolderError(path)).toBe('Enter a folder inside the chosen folder, not a full path.')
  })

  it('refuses parent folder segments and empty segments', () => {
    expect(getSubfolderError('a\\..\\b')).toBe('Folder names can\'t be "." or "..".')
    expect(getSubfolderError('a\\\\b')).toBe('Remove the empty folder name.')
    expect(getSubfolderError('a\\')).toBe('Remove the empty folder name.')
  })
})

describe('normalizeSubfolder', () => {
  it('joins the segments with backslashes', () => {
    expect(normalizeSubfolder('a/b\\c')).toBe('a\\b\\c')
    expect(normalizeSubfolder('')).toBe('')
  })
})

describe('getShareFileName and isValidShareFileName', () => {
  it('keeps only the last path segment', () => {
    expect(getShareFileName('C:\\fakepath\\notes.pdf')).toBe('notes.pdf')
    expect(getShareFileName('notes.pdf')).toBe('notes.pdf')
  })

  it('allows names up to 200 characters and refuses invalid ones', () => {
    expect(isValidShareFileName(`${'a'.repeat(196)}.pdf`)).toBe(true)
    expect(isValidShareFileName(`${'a'.repeat(197)}.pdf`)).toBe(false)
    expect(isValidShareFileName('nul.txt')).toBe(false)
    expect(isValidShareFileName('desktop.ini')).toBe(false)
    expect(isValidShareFileName('report\u202efdp.exe')).toBe(false)
    expect(isValidShareFileName('REPORT~1.PDF')).toBe(false)
  })
})

describe('sendFileSchema', () => {
  it('fills in Desktop and the default subfolder', () => {
    expect(sendFileSchema.parse({ file: notes })).toEqual({
      file: notes,
      folder: 'desktop',
      subfolder: 'Lykantra Share',
    })
  })

  it('normalizes the subfolder separators', () => {
    const values = sendFileSchema.parse({ file: notes, folder: 'downloads', subfolder: 'a/b' })
    expect(values).toMatchObject({ folder: 'downloads', subfolder: 'a\\b' })
  })

  it('accepts an empty subfolder', () => {
    expect(sendFileSchema.parse({ file: notes, subfolder: '' }).subfolder).toBe('')
  })

  it('asks for a file when none is chosen', () => {
    expect(firstMessage({ folder: 'desktop', subfolder: '' })).toBe(CHOOSE_FILE_MESSAGE)
  })

  it('refuses a file whose name Windows cannot save', () => {
    expect(firstMessage({ file: new File(['x'], 'aux.txt') })).toBe(INVALID_FILE_NAME_MESSAGE)
    expect(firstMessage({ file: new File(['x'], 'CON .txt') })).toBe(INVALID_FILE_NAME_MESSAGE)
  })

  it('refuses an unknown folder and an invalid subfolder', () => {
    expect(sendFileSchema.safeParse({ file: notes, folder: 'windows' }).success).toBe(false)
    expect(firstMessage({ file: notes, subfolder: '..' })).toBe('Folder names can\'t be "." or "..".')
  })
})

describe('formatSharePath', () => {
  it('shows the folder, the subfolder and the file name', () => {
    expect(formatSharePath('desktop', 'Lykantra Share', 'notes.pdf')).toBe(
      'Desktop\\Lykantra Share\\notes.pdf',
    )
  })

  it('leaves out an empty subfolder and a missing file name', () => {
    expect(formatSharePath('documents', '', 'notes.pdf')).toBe('Documents\\notes.pdf')
    expect(formatSharePath('downloads', 'a/b')).toBe('Downloads\\a\\b')
  })
})
