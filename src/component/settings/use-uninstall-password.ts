import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import {
  clearUninstallPassword,
  getUninstallPasswordStatus,
  setUninstallPassword,
  type UninstallPasswordStatus,
} from '../../lib/uninstall-password-api'
import { useSessionRequest } from '../auth/use-session-request'

export type UninstallPasswordLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; isSet: boolean }
  | { status: 'error'; error: string }

export function useUninstallPassword() {
  const request = useSessionRequest()
  const [loadState, setLoadState] = useState<UninstallPasswordLoadState>({ status: 'loading' })
  const [isClearing, setIsClearing] = useState(false)
  // Checked synchronously so a double click cannot send a second save or clear.
  const isActionInFlight = useRef(false)

  const applyStatus = useCallback((result: ApiResult<UninstallPasswordStatus>) => {
    if (result.success) setLoadState({ status: 'loaded', isSet: result.data.isSet })
  }, [])

  const applyLoadResult = useCallback((result: ApiResult<UninstallPasswordStatus>) => {
    if (result.success) {
      setLoadState({ status: 'loaded', isSet: result.data.isSet })
    } else if (!isSessionExpired(result)) {
      setLoadState({ status: 'error', error: result.error })
    }
  }, [])

  const load = useCallback(
    () => request(getUninstallPasswordStatus()).then(applyLoadResult),
    [request, applyLoadResult],
  )

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(() => {
    setLoadState({ status: 'loading' })
    void load()
  }, [load])

  // Null means another save or clear is still running.
  const runAction = useCallback(
    async (
      sendRequest: () => Promise<ApiResult<UninstallPasswordStatus>>,
    ): Promise<ApiResult<UninstallPasswordStatus> | null> => {
      if (isActionInFlight.current) return null
      isActionInFlight.current = true
      try {
        const result = await request(sendRequest())
        applyStatus(result)
        return result
      } finally {
        isActionInFlight.current = false
      }
    },
    [request, applyStatus],
  )

  const savePassword = useCallback(
    (password: string) => runAction(() => setUninstallPassword(password)),
    [runAction],
  )

  const clearPassword = useCallback(async () => {
    setIsClearing(true)
    try {
      return await runAction(() => clearUninstallPassword())
    } finally {
      setIsClearing(false)
    }
  }, [runAction])

  return { loadState, retry, isClearing, savePassword, clearPassword }
}
