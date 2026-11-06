import { useCallback, useEffect, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import { getServerInfo, type ServerInfo } from '../../lib/server-info-api'
import { useSessionRequest } from '../auth/use-session-request'

export type ServerInfoLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; info: ServerInfo }
  | { status: 'error'; error: string }

export function useServerInfo() {
  const request = useSessionRequest()
  const [loadState, setLoadState] = useState<ServerInfoLoadState>({ status: 'loading' })

  const applyResult = useCallback((result: ApiResult<ServerInfo>) => {
    if (result.success) {
      setLoadState({ status: 'loaded', info: result.data })
    } else if (!isSessionExpired(result)) {
      setLoadState({ status: 'error', error: result.error })
    }
  }, [])

  const load = useCallback(() => request(getServerInfo()).then(applyResult), [request, applyResult])

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(() => {
    setLoadState({ status: 'loading' })
    void load()
  }, [load])

  return { loadState, retry }
}
