import { describe, expect, it } from 'vitest'
import {
  buildTextMessage,
  getPasteAnnouncement,
  isPasteShortcut,
  isTypableChunk,
  MAX_PASTE_LENGTH,
  normalizePasteText,
  NOTHING_TO_PASTE_MESSAGE,
  PASTE_CHUNK_INTERVAL_MS,
  PASTE_CHUNK_LENGTH,
  PASTE_TOO_LONG_MESSAGE,
  preparePasteText,
  splitPasteText,
} from './paste-text'

const EMOJI = '😀'

describe('paste limits', () => {
  it('allow 10,000 code units per paste and 64 per chunk', () => {
    expect(MAX_PASTE_LENGTH).toBe(10_000)
    expect(PASTE_CHUNK_LENGTH).toBe(64)
  })

  it('send a chunk every 80 ms, 12.5 a second', () => {
    expect(PASTE_CHUNK_INTERVAL_MS).toBe(80)
  })
})

describe('normalizePasteText', () => {
  it('turns "\\r\\n" and a lone "\\r" into "\\n"', () => {
    expect(normalizePasteText('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
  })

  it('keeps tabs, newlines, emoji and joiners', () => {
    const text = 'name\tvalue\n👩‍💻 café'
    expect(normalizePasteText(text)).toBe(text)
  })

  it.each([
    ['NUL', 'a\u0000b'],
    ['bell', 'a\u0007b'],
    ['escape', 'a\u001bb'],
    ['vertical tab', 'a\u000bb'],
    ['form feed', 'a\u000cb'],
    ['DEL', 'a\u007fb'],
    ['C1 next line', 'a\u0085b'],
    ['C1 end', 'a\u009fb'],
  ])('drops the %s control character', (_name, text) => {
    expect(normalizePasteText(text)).toBe('ab')
  })

  it('drops unpaired surrogates and keeps paired ones', () => {
    expect(normalizePasteText(`a\uD83Db\uDE00c${EMOJI}`)).toBe(`abc${EMOJI}`)
  })
})

describe('splitPasteText', () => {
  it('returns no chunks for empty text', () => {
    expect(splitPasteText('')).toEqual([])
  })

  it('splits into chunks of at most 64 code units', () => {
    const chunks = splitPasteText('a'.repeat(130))
    expect(chunks.map((chunk) => chunk.length)).toEqual([64, 64, 2])
    expect(chunks.join('')).toBe('a'.repeat(130))
  })

  it('keeps text of exactly 64 code units in one chunk', () => {
    expect(splitPasteText('a'.repeat(64))).toEqual(['a'.repeat(64)])
  })

  it('never splits a surrogate pair across chunks', () => {
    const text = `${'a'.repeat(63)}${EMOJI}b`
    const chunks = splitPasteText(text)
    expect(chunks).toEqual(['a'.repeat(63), `${EMOJI}b`])
    expect(chunks.every(isTypableChunk)).toBe(true)
  })

  it('keeps a surrogate pair that ends exactly at the chunk boundary', () => {
    const text = `${'a'.repeat(62)}${EMOJI}b`
    expect(splitPasteText(text)).toEqual([`${'a'.repeat(62)}${EMOJI}`, 'b'])
  })

  it('splits a long run of emoji into valid chunks', () => {
    const text = EMOJI.repeat(100)
    const chunks = splitPasteText(text)
    expect(chunks.join('')).toBe(text)
    expect(chunks.every(isTypableChunk)).toBe(true)
  })
})

describe('isTypableChunk', () => {
  it.each(['a', 'line\n', 'tab\t', EMOJI, 'a'.repeat(64)])('accepts %j', (chunk) => {
    expect(isTypableChunk(chunk)).toBe(true)
  })

  it.each(['', 'a'.repeat(65), 'a\r', 'a\u0000', 'a\u007f', 'a\u0085', '\uD83D', '\uDE00'])(
    'refuses %j',
    (chunk) => {
      expect(isTypableChunk(chunk)).toBe(false)
    },
  )
})

describe('buildTextMessage', () => {
  it('builds exactly {"t":"text","s":chunk}', () => {
    expect(buildTextMessage('Hi "you"\n')).toBe('{"t":"text","s":"Hi \\"you\\"\\n"}')
  })

  it('returns null for a chunk the server would drop', () => {
    expect(buildTextMessage('')).toBeNull()
    expect(buildTextMessage('a\r')).toBeNull()
    expect(buildTextMessage('a'.repeat(65))).toBeNull()
  })
})

describe('preparePasteText', () => {
  it('normalizes and splits the text', () => {
    expect(preparePasteText('one\r\ntwo')).toEqual({ success: true, chunks: ['one\ntwo'] })
  })

  it.each(['', '\u0000\u0007'])('refuses text with nothing to type: %j', (text) => {
    expect(preparePasteText(text)).toEqual({ success: false, error: NOTHING_TO_PASTE_MESSAGE })
  })

  it('accepts exactly 10,000 code units after normalization', () => {
    const result = preparePasteText('a'.repeat(MAX_PASTE_LENGTH))
    expect(result.success).toBe(true)
  })

  it('counts length after normalization, so "\\r\\n" counts once', () => {
    const result = preparePasteText(`${'a'.repeat(MAX_PASTE_LENGTH - 1)}\r\n`)
    expect(result.success).toBe(true)
  })

  it('refuses more than 10,000 code units', () => {
    expect(preparePasteText('a'.repeat(MAX_PASTE_LENGTH + 1))).toEqual({
      success: false,
      error: PASTE_TOO_LONG_MESSAGE,
    })
  })
})

describe('isPasteShortcut', () => {
  const keys = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }

  it.each([
    { ...keys, code: 'KeyV', ctrlKey: true },
    { ...keys, code: 'KeyV', metaKey: true },
    { ...keys, code: 'KeyV', ctrlKey: true, shiftKey: true },
    { ...keys, code: 'Insert', shiftKey: true },
  ])('matches %o', (event) => {
    expect(isPasteShortcut(event)).toBe(true)
  })

  it.each([
    { ...keys, code: 'KeyV' },
    { ...keys, code: 'KeyV', shiftKey: true },
    { ...keys, code: 'KeyV', ctrlKey: true, altKey: true },
    { ...keys, code: 'Insert' },
    { ...keys, code: 'Insert', ctrlKey: true },
    { ...keys, code: 'Insert', shiftKey: true, ctrlKey: true },
    { ...keys, code: 'KeyC', ctrlKey: true },
  ])('does not match %o', (event) => {
    expect(isPasteShortcut(event)).toBe(false)
  })
})

describe('getPasteAnnouncement', () => {
  it.each([
    [0, 'Typing…'],
    [24, 'Typing…'],
    [25, 'Typing… 25%'],
    [49, 'Typing… 25%'],
    [50, 'Typing… 50%'],
    [75, 'Typing… 75%'],
    [99, 'Typing… 75%'],
  ])('announces %i%% in steps of 25 as %j', (percent, announcement) => {
    expect(getPasteAnnouncement(percent, null)).toBe(announcement)
  })

  it('announces how the paste ended', () => {
    expect(getPasteAnnouncement(null, 'typed')).toBe('Typed on the PC.')
    expect(getPasteAnnouncement(null, 'stopped')).toBe('Stopped.')
  })

  it('announces nothing before any paste', () => {
    expect(getPasteAnnouncement(null, null)).toBe('')
  })
})
