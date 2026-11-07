import { describe, expect, it } from 'vitest'
import { countMessageLines, MAX_MESSAGE_LENGTH, sendMessageSchema } from './message-schema'

function parseText(text: string) {
  return sendMessageSchema.safeParse({ text })
}

function errorFor(text: string): string | undefined {
  const result = parseText(text)
  return result.success ? undefined : result.error.issues[0]?.message
}

describe('sendMessageSchema', () => {
  it('accepts a plain message', () => {
    expect(parseText('Please save your work.')).toEqual({
      success: true,
      data: { text: 'Please save your work.' },
    })
  })

  it('trims spaces around the message', () => {
    expect(parseText('  Lunch break  ')).toEqual({ success: true, data: { text: 'Lunch break' } })
  })

  it('rejects an empty message', () => {
    expect(errorFor('')).toBe('Enter a message.')
  })

  it('rejects a message of only spaces', () => {
    expect(errorFor('   \n  ')).toBe('Enter a message.')
  })

  it('accepts exactly 500 characters', () => {
    expect(parseText('a'.repeat(MAX_MESSAGE_LENGTH)).success).toBe(true)
  })

  it('rejects 501 characters', () => {
    expect(errorFor('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toBe(
      `Use ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    )
  })

  it('counts length after trimming', () => {
    expect(parseText(` ${'a'.repeat(MAX_MESSAGE_LENGTH)} `).success).toBe(true)
  })

  it('accepts 10 lines', () => {
    expect(parseText(Array(10).fill('line').join('\n')).success).toBe(true)
  })

  it('rejects 11 lines', () => {
    expect(errorFor(Array(11).fill('line').join('\n'))).toBe('Use 10 lines or fewer.')
  })

  it('accepts newlines and printable Unicode', () => {
    expect(parseText('Hola ñ — 😀\nGracias').success).toBe(true)
  })

  it('normalises CRLF and CR line endings to newlines', () => {
    expect(parseText('one\r\ntwo\rthree')).toEqual({
      success: true,
      data: { text: 'one\ntwo\nthree' },
    })
  })

  it.each([
    ['a tab', 'a\tb'],
    ['NUL', 'a\u0000b'],
    ['escape', 'a\u001bb'],
    ['DEL', 'a\u007fb'],
    ['a C1 control', 'a\u0085b'],
  ])('rejects a control character (%s)', (_label, text) => {
    expect(errorFor(text)).toBe('Remove tabs and other special characters.')
  })

  it.each([
    ['ARABIC LETTER MARK', '؜'],
    ['ZERO WIDTH SPACE', '​'],
    ['LEFT-TO-RIGHT MARK', '‎'],
    ['RIGHT-TO-LEFT MARK', '‏'],
    ['LEFT-TO-RIGHT EMBEDDING', '‪'],
    ['RIGHT-TO-LEFT OVERRIDE', '‮'],
    ['LEFT-TO-RIGHT ISOLATE', '⁦'],
    ['POP DIRECTIONAL ISOLATE', '⁩'],
    ['LINE SEPARATOR', ' '],
    ['PARAGRAPH SEPARATOR', ' '],
    ['BYTE ORDER MARK', '﻿'],
  ])('rejects a direction or invisible character (%s)', (_label, character) => {
    expect(errorFor(`safe${character}text`)).toBe(
      "The message can't contain direction or invisible formatting characters.",
    )
  })

  it('accepts a zero width joiner inside an emoji sequence', () => {
    expect(parseText('family \u{1F468}‍\u{1F469}‍\u{1F467}').success).toBe(true)
  })

  it('accepts a zero width non-joiner', () => {
    expect(parseText('a‌b').success).toBe(true)
  })

  it('rejects an unpaired high surrogate', () => {
    expect(errorFor('a\uD83Db')).toBe('Remove tabs and other special characters.')
  })

  it('rejects an unpaired low surrogate', () => {
    expect(errorFor('a\uDE00b')).toBe('Remove tabs and other special characters.')
  })
})

describe('countMessageLines', () => {
  it('counts one line for text without newlines', () => {
    expect(countMessageLines('hello')).toBe(1)
  })

  it('counts each newline as a new line', () => {
    expect(countMessageLines('a\nb\nc')).toBe(3)
  })
})
