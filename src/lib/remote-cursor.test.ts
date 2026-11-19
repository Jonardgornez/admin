import { describe, expect, it } from 'vitest'
import { cursorToCss, parseServerCursorMessage, REMOTE_CURSOR_NAMES } from './remote-cursor'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg=='

function imageMessage(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ cursor: 'image', x: 3, y: 5, png: PNG, ...overrides })
}

describe('parseServerCursorMessage', () => {
  it.each(REMOTE_CURSOR_NAMES)('accepts the standard cursor %s', (name) => {
    expect(parseServerCursorMessage(JSON.stringify({ cursor: name }))).toEqual({ cursor: name })
  })

  it('accepts an image cursor', () => {
    expect(parseServerCursorMessage(imageMessage())).toEqual({ cursor: 'image', x: 3, y: 5, png: PNG })
  })

  it('accepts hotspots at 0 and 63', () => {
    expect(parseServerCursorMessage(imageMessage({ x: 0, y: 63 }))).not.toBeNull()
  })

  it('accepts a png of exactly 22,000 characters', () => {
    expect(parseServerCursorMessage(imageMessage({ png: 'A'.repeat(22_000) }))).not.toBeNull()
  })

  it.each([
    ['an unknown name', '{"cursor":"grab"}'],
    ['a CSS injection as the name', '{"cursor":"url(x), default"}'],
    ['an extra field on a name', '{"cursor":"text","x":1}'],
    ['a missing cursor field', '{"x":1}'],
    ['text that is not JSON', 'cursor'],
    ['a state message', '{"state":"live"}'],
    ['a control message', '{"control":"on"}'],
  ])('rejects %s', (_label, text) => {
    expect(parseServerCursorMessage(text)).toBeNull()
  })

  it.each([
    ['a negative x', { x: -1 }],
    ['an x above 63', { x: 64 }],
    ['a y above 63', { y: 64 }],
    ['a fractional y', { y: 1.5 }],
    ['a string x', { x: '3' }],
    ['a missing png', { png: undefined }],
    ['an empty png', { png: '' }],
    ['a png with a quote', { png: 'abc")' }],
    ['a png with a space', { png: 'ab cd' }],
    ['a png with URL-safe characters', { png: 'ab-_' }],
    ['a png with too much padding', { png: 'abc===' }],
    ['a png over 22,000 characters', { png: 'A'.repeat(22_001) }],
    ['an extra field', { extra: true }],
  ])('rejects an image cursor with %s', (_label, overrides) => {
    expect(parseServerCursorMessage(imageMessage(overrides))).toBeNull()
  })
})

describe('cursorToCss', () => {
  it('returns the name of a standard cursor', () => {
    expect(cursorToCss({ cursor: 'nwse-resize' })).toBe('nwse-resize')
  })

  it('returns a data URL with the hotspot and an arrow fallback for an image cursor', () => {
    expect(cursorToCss({ cursor: 'image', x: 3, y: 5, png: PNG })).toBe(
      `url("data:image/png;base64,${PNG}") 3 5, default`,
    )
  })
})
