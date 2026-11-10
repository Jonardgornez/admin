import { useCallback, useEffect, useRef, useState } from 'react'
import { isSessionExpired } from '../../lib/auth-state'
import type { LogFilters } from '../../lib/logs'
import { listSessionLogs } from '../../lib/session-logs-api'
import type { SessionLogPage } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'

export interface SessionLogQuery {
  filters: LogFilters
  page: number
}

type SessionLogsLoadState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; error: string }

export function useSessionLogs(query: SessionLogQuery) {
  const request = useSessionRequest()
  const [data, setData] = useState<SessionLogPage | null>(null)
  const [loadState, setLoadState] = useState<SessionLogsLoadState>({ status: 'loading' })
  const latestLoadId = useRef(0)

  // An expired session signs the admin out, which redirects away from this page, so the load state is left alone.
  const load = useCallback(async () => {
    const loadId = ++latestLoadId.current
    setLoadState({ status: 'loading' })
    const result = await request(listSessionLogs(query.filters, query.page))
    // A newer load started, so this answer is stale.
    if (loadId !== latestLoadId.current) return
    if (result.success) {
      setData(result.data)
      setLoadState({ status: 'loaded' })
    } else if (!isSessionExpired(result)) {
      setLoadState({ status: 'error', error: result.error })
    }
  }, [request, query])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loadState, reload: load }
}
