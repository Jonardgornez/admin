export interface KeyboardLock {
  lock: () => Promise<void>
  unlock: () => void
}

function isKeyboardLock(value: unknown): value is KeyboardLock {
  return (
    typeof value === 'object' &&
    value !== null &&
    'lock' in value &&
    'unlock' in value &&
    typeof value.lock === 'function' &&
    typeof value.unlock === 'function'
  )
}

// Chromium's Keyboard Lock API. Other browsers return null, so callers must handle that.
export function getKeyboardLock(browserNavigator: object): KeyboardLock | null {
  const keyboard: unknown = Reflect.get(browserNavigator, 'keyboard')
  return isKeyboardLock(keyboard) ? keyboard : null
}
