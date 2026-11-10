import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import {
  getClientRelease,
  removeClientRelease,
  uploadClientRelease,
} from '../../lib/client-updates-api'
import { formatClientVersion } from '../../lib/client-updates'
import type { ClientRelease } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'
import { useNotify } from '../ui/notification-context'

export type ClientReleaseLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; release: ClientRelease | null }
  | { status: 'error'; error: string }

export type ClientReleaseActionType = 'uploading' | 'removing'

export function useClientRelease() {
  const request = useSessionRequest()
  const notify = useNotify()
  const [loadState, setLoadState] = useState<ClientReleaseLoadState>({ status: 'loading' })
  const [busyAction, setBusyAction] = useState<ClientReleaseActionType | null>(null)
  // Checked synchronously so a double click cannot start a second upload or removal.
  const isActionInFlight = useRef(false)

  const applyLoadResult = useCallback((result: ApiResult<ClientRelease | null>) => {
    if (result.success) {
      setLoadState({ status: 'loaded', release: result.data })
    } else if (!isSessionExpired(result)) {
      setLoadState({ status: 'error', error: result.error })
    }
  }, [])

  const load = useCallback(
    () => request(getClientRelease()).then(applyLoadResult),
    [request, applyLoadResult],
  )

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(() => {
    setLoadState({ status: 'loading' })
    void load()
  }, [load])

  // Reads the release again without showing the loading state, and resolves with what the server sent.
  const refreshRelease = useCallback(async () => {
    const result = await request(getClientRelease())
    applyLoadResult(result)
    return result
  }, [request, applyLoadResult])

  const setLoadedRelease = useCallback((release: ClientRelease | null) => {
    setLoadState((previous) =>
      previous.status === 'loaded' ? { status: 'loaded', release } : previous,
    )
  }, [])

  // Takes a function, not a promise, so a refused second action never sends its request.
  // Null means another upload or removal is still running.
  const runAction = useCallback(
    async <T,>(
      action: ClientReleaseActionType,
      sendRequest: () => Promise<ApiResult<T>>,
    ): Promise<ApiResult<T> | null> => {
      if (isActionInFlight.current) return null
      isActionInFlight.current = true
      setBusyAction(action)
      try {
        return await request(sendRequest())
      } finally {
        isActionInFlight.current = false
        setBusyAction(null)
      }
    },
    [request],
  )

  const uploadRelease = useCallback(
    async (file: File) => {
      const result = await runAction('uploading', () => uploadClientRelease(file))
      if (result?.success) {
        setLoadedRelease(result.data)
        notify(`Client update ${formatClientVersion(result.data.version)} uploaded.`)
      }
      return result
    },
    [runAction, setLoadedRelease, notify],
  )

  const removeRelease = useCallback(async () => {
    const result = await runAction('removing', () => removeClientRelease())
    if (result?.success) {
      setLoadedRelease(null)
      notify('Client update removed.')
    }
    return result
  }, [runAction, setLoadedRelease, notify])

  return { loadState, retry, refreshRelease, busyAction, uploadRelease, removeRelease }
}
