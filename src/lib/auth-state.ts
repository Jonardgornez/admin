import type { ApiResult } from './api'
import type { AdminSession } from './auth-api'

export const SESSION_EXPIRED_NOTICE = 'Your session expired. Sign in again.'
export const PASSWORD_CHANGED_NOTICE = 'Password changed. Sign in with your new password.'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-in'; username: string }
  | { status: 'signed-out'; notice?: string }
  | { status: 'unreachable'; error: string }

const UNAUTHORIZED_STATUS = 401

export function authStateFromResult(result: ApiResult<AdminSession>): AuthState {
  if (result.success) return { status: 'signed-in', username: result.data.username }
  if (result.status === UNAUTHORIZED_STATUS) return { status: 'signed-out' }
  return { status: 'unreachable', error: result.error }
}

// Combines the previous state with a fresh server check so that a dropped
// connection never signs the admin out or hides the console they already see.
export function reconcileAuthState(previous: AuthState, next: AuthState): AuthState {
  if (previous.status === 'signed-out') return previous
  if (next.status === 'unreachable' && previous.status === 'signed-in') return previous
  if (next.status === 'signed-out' && previous.status === 'signed-in') {
    return { status: 'signed-out', notice: SESSION_EXPIRED_NOTICE }
  }
  return next
}

export function readNotice(routerState: unknown): string | undefined {
  if (typeof routerState !== 'object' || routerState === null || !('notice' in routerState)) {
    return undefined
  }
  const { notice } = routerState
  return typeof notice === 'string' && notice !== '' ? notice : undefined
}
