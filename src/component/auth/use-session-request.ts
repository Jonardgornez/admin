import { useCallback } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired, SESSION_EXPIRED_NOTICE } from '../../lib/auth-state'
import { useAuth } from './auth-context'

export type SessionRequest = <T>(request: Promise<ApiResult<T>>) => Promise<ApiResult<T>>

// For data requests only. Sign-in and change-password must not use this: a 401
// there means wrong credentials, not an expired session.
export function useSessionRequest(): SessionRequest {
  const { markSignedOut } = useAuth()

  return useCallback(
    async <T,>(request: Promise<ApiResult<T>>) => {
      const result = await request
      if (isSessionExpired(result)) markSignedOut(SESSION_EXPIRED_NOTICE)
      return result
    },
    [markSignedOut],
  )
}
