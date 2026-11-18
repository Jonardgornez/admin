import { describe, expect, it } from 'vitest'
import { MAX_PASTE_LENGTH, PASTE_TOO_LONG_MESSAGE } from './paste-text'
import { PASTE_TEXT_REQUIRED_MESSAGE, pasteTextSchema } from './paste-text-schema'

function issueOf(text: string): string | undefined {
  const result = pasteTextSchema.safeParse({ text })
  return result.success ? undefined : result.error.issues[0].message
}

describe('pasteTextSchema', () => {
  it('normalizes line breaks and drops untypable characters', () => {
    expect(pasteTextSchema.parse({ text: 'a\r\nb\u0007' })).toEqual({ text: 'a\nb' })
  })

  it.each(['', '\u0000'])('requires text, refusing %j', (text) => {
    expect(issueOf(text)).toBe(PASTE_TEXT_REQUIRED_MESSAGE)
  })

  it('keeps whitespace-only text, since spaces can be typed', () => {
    expect(issueOf('  \n')).toBeUndefined()
  })

  it('accepts exactly 10,000 code units and refuses 10,001', () => {
    expect(issueOf('a'.repeat(MAX_PASTE_LENGTH))).toBeUndefined()
    expect(issueOf('a'.repeat(MAX_PASTE_LENGTH + 1))).toBe(PASTE_TOO_LONG_MESSAGE)
  })

  it('counts UTF-16 code units, so an emoji counts as two', () => {
    expect(issueOf(`${'a'.repeat(MAX_PASTE_LENGTH - 1)}😀`)).toBe(PASTE_TOO_LONG_MESSAGE)
  })

  it('counts the length after normalization', () => {
    expect(issueOf(`${'a'.repeat(MAX_PASTE_LENGTH)}\u0007`)).toBeUndefined()
  })
})
