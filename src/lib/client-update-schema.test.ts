import { describe, expect, it } from 'vitest'
import {
  CLIENT_INSTALLER_MAX_BYTES,
  CLIENT_UPDATE_ERROR_MAX_CHARS,
  clientUpdateStatusSchema,
  clientVersionSchema,
  getClientInstallerFileError,
  sanitizeClientUpdateError,
} from './client-update-schema'

const NAME_MESSAGE = 'Choose LykantraSetup.exe.'
const SIZE_MESSAGE = 'The installer must be 150 MB or smaller.'

function makeFile(name: string, sizeBytes = 1024): File {
  const file = new File([new Uint8Array(0)], name, { type: 'application/x-msdownload' })
  // A real 150 MB file is too big to build in a test, so only the reported size changes.
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

describe('getClientInstallerFileError', () => {
  it('returns null for LykantraSetup.exe', () => {
    expect(getClientInstallerFileError(makeFile('LykantraSetup.exe'))).toBeNull()
  })

  it('accepts an upper-case .EXE extension', () => {
    expect(getClientInstallerFileError(makeFile('LYKANTRA.EXE'))).toBeNull()
  })

  it.each(['LykantraSetup.zip', 'LykantraSetup.exe.txt', 'LykantraSetup', 'setup.msi'])(
    'rejects %s with the name message',
    (name) => {
      expect(getClientInstallerFileError(makeFile(name))).toBe(NAME_MESSAGE)
    },
  )

  it('accepts a file of exactly the maximum size', () => {
    expect(getClientInstallerFileError(makeFile('a.exe', CLIENT_INSTALLER_MAX_BYTES))).toBeNull()
  })

  it('rejects a file one byte over the maximum size with the size message', () => {
    expect(getClientInstallerFileError(makeFile('a.exe', CLIENT_INSTALLER_MAX_BYTES + 1))).toBe(
      SIZE_MESSAGE,
    )
  })

  it('reports the name problem first when a file is both the wrong name and too large', () => {
    expect(getClientInstallerFileError(makeFile('a.zip', CLIENT_INSTALLER_MAX_BYTES + 1))).toBe(
      NAME_MESSAGE,
    )
  })
})

describe('clientVersionSchema', () => {
  it.each(['0.20.0', '1.0.0', '10.4.123'])('accepts %s', (version) => {
    expect(clientVersionSchema.safeParse(version).success).toBe(true)
  })

  it.each([
    '0.20',
    '1.2.3.4',
    'v0.20.0',
    '0.20.0-beta',
    '',
    'a.b.c',
    '01.2.3',
    '1.2.3\n',
    '1234567890.0.0',
  ])('rejects %j', (version) => {
    expect(clientVersionSchema.safeParse(version).success).toBe(false)
  })
})

describe('clientUpdateStatusSchema', () => {
  it('accepts a failed update with its error text', () => {
    const update = { targetVersion: '0.20.0', state: 'failed', error: 'Disk full.' }
    expect(clientUpdateStatusSchema.parse(update)).toEqual(update)
  })

  it('rejects a state outside the four the server sends', () => {
    expect(
      clientUpdateStatusSchema.safeParse({ targetVersion: '0.20.0', state: 'done', error: null })
        .success,
    ).toBe(false)
  })
})

describe('sanitizeClientUpdateError', () => {
  it('keeps ordinary text as it is', () => {
    expect(sanitizeClientUpdateError('Not enough disk space.')).toBe('Not enough disk space.')
  })

  it('turns control characters and bidi overrides into spaces', () => {
    expect(sanitizeClientUpdateError('Disk\u0000full\u202Eerror\u200F\u2066x')).toBe(
      'Disk full error  x',
    )
  })

  it('trims the text and caps it at 200 characters', () => {
    const result = sanitizeClientUpdateError(`  ${'y'.repeat(300)}  `)
    expect(result).toHaveLength(CLIENT_UPDATE_ERROR_MAX_CHARS)
    expect(result).toBe('y'.repeat(200))
  })

  it('does not split a character in two when capping', () => {
    const result = sanitizeClientUpdateError('😀'.repeat(201))
    expect(result).toBe('😀'.repeat(200))
  })

  it('returns null when nothing readable is left', () => {
    expect(sanitizeClientUpdateError('\u0000 \u202E  ')).toBeNull()
    expect(sanitizeClientUpdateError(null)).toBeNull()
  })
})
