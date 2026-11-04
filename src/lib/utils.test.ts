import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins class names and skips falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('supports conditional object syntax', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b')
  })

  it('lets later conflicting Tailwind utilities win', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('returns an empty string with no input', () => {
    expect(cn()).toBe('')
  })
})
