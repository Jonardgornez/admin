import { describe, expect, it } from 'vitest'
import { getKeyboardLock } from './keyboard-lock'

describe('getKeyboardLock', () => {
  it('returns null when the browser has no Keyboard Lock API', () => {
    expect(getKeyboardLock({})).toBeNull()
  })

  it('returns null when keyboard is not a lock object', () => {
    expect(getKeyboardLock({ keyboard: { lock: 1, unlock: 2 } })).toBeNull()
    expect(getKeyboardLock({ keyboard: null })).toBeNull()
  })

  it('returns the lock object when lock and unlock are functions', () => {
    const keyboard = {
      lock: () => Promise.resolve(),
      unlock: () => undefined,
    }
    expect(getKeyboardLock({ keyboard })).toBe(keyboard)
  })
})
