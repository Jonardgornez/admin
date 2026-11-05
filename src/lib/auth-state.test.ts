import { describe, expect, it } from 'vitest'
import {
  authStateFromResult,
  readNotice,
  reconcileAuthState,
  SESSION_EXPIRED_NOTICE,
  type AuthState,
} from './auth-state'

const signedIn: AuthState = { status: 'signed-in', username: 'admin' }
const unreachable: AuthState = { status: 'unreachable', error: 'down' }

describe('authStateFromResult', () => {
  it('maps success to signed-in', () => {
    expect(authStateFromResult({ success: true, data: { username: 'admin' } })).toEqual(signedIn)
  })

  it('maps 401 to signed-out', () => {
    expect(authStateFromResult({ success: false, status: 401, error: 'x' })).toEqual({
      status: 'signed-out',
    })
  })

  it('maps network and server failures to unreachable, not signed-out', () => {
    expect(authStateFromResult({ success: false, status: 0, error: 'down' })).toEqual(unreachable)
    expect(authStateFromResult({ success: false, status: 500, error: 'down' })).toEqual(unreachable)
  })
})

describe('reconcileAuthState', () => {
  it('adds the expiry notice when a signed-in session turns out to be gone', () => {
    expect(reconcileAuthState(signedIn, { status: 'signed-out' })).toEqual({
      status: 'signed-out',
      notice: SESSION_EXPIRED_NOTICE,
    })
  })

  it('shows no expiry notice on the first check', () => {
    expect(reconcileAuthState({ status: 'loading' }, { status: 'signed-out' })).toEqual({
      status: 'signed-out',
    })
  })

  it('keeps a signed-in admin when the server cannot be reached', () => {
    expect(reconcileAuthState(signedIn, unreachable)).toEqual(signedIn)
  })

  it('reports unreachable while loading', () => {
    expect(reconcileAuthState({ status: 'loading' }, unreachable)).toEqual(unreachable)
  })

  it('keeps an explicit sign-out and its notice', () => {
    const signedOut: AuthState = { status: 'signed-out', notice: 'bye' }
    expect(reconcileAuthState(signedOut, signedIn)).toEqual(signedOut)
  })
})

describe('readNotice', () => {
  it('reads a notice string from router state', () => {
    expect(readNotice({ notice: 'hello' })).toBe('hello')
  })

  it('ignores missing, empty, or malformed state', () => {
    expect(readNotice(null)).toBeUndefined()
    expect(readNotice('x')).toBeUndefined()
    expect(readNotice({})).toBeUndefined()
    expect(readNotice({ notice: '' })).toBeUndefined()
    expect(readNotice({ notice: 5 })).toBeUndefined()
  })
})
