import { useCallback, useEffect, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import {
  BACKGROUND_COPY,
  type BackgroundKind,
} from '../../lib/backgrounds'
import {
  getBackgrounds,
  removeBackground,
  uploadBackground,
  type BackgroundInfo,
  type BackgroundSet,
} from '../../lib/backgrounds-api'
import { useSessionRequest } from '../auth/use-session-request'
import { useNotify } from '../ui/notification-context'

export type BackgroundActionType = 'saving' | 'removing'

export type BackgroundsLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; backgrounds: BackgroundSet }
  | { status: 'error'; error: string }

export function useScreenBackgrounds() {
  const request = useSessionRequest()
  const notify = useNotify()
  const [loadState, setLoadState] = useState<BackgroundsLoadState>({ status: 'loading' })
  const [busyActions, setBusyActions] = useState<
    Partial<Record<BackgroundKind, BackgroundActionType>>
  >({})

  const applyLoadResult = useCallback((result: ApiResult<BackgroundSet>) => {
    if (result.success) {
      setLoadState({ status: 'loaded', backgrounds: result.data })
    } else if (!isSessionExpired(result)) {
      setLoadState({ status: 'error', error: result.error })
    }
  }, [])

  const load = useCallback(
    () => request(getBackgrounds()).then(applyLoadResult),
    [request, applyLoadResult],
  )

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(() => {
    setLoadState({ status: 'loading' })
    void load()
  }, [load])

  const runAction = useCallback(
    async <T,>(
      kind: BackgroundKind,
      action: BackgroundActionType,
      pending: Promise<ApiResult<T>>,
    ): Promise<ApiResult<T>> => {
      setBusyActions((previous) => ({ ...previous, [kind]: action }))
      try {
        return await request(pending)
      } finally {
        setBusyActions((previous) => ({ ...previous, [kind]: undefined }))
      }
    },
    [request],
  )

  const setLoadedBackground = useCallback((kind: BackgroundKind, info: BackgroundInfo | null) => {
    setLoadState((previous) =>
      previous.status === 'loaded'
        ? { status: 'loaded', backgrounds: { ...previous.backgrounds, [kind]: info } }
        : previous,
    )
  }, [])

  const saveBackground = useCallback(
    async (kind: BackgroundKind, file: File) => {
      const result = await runAction(kind, 'saving', uploadBackground(kind, file))
      if (result.success) {
        setLoadedBackground(kind, result.data)
        notify(`${BACKGROUND_COPY[kind].title} background saved.`)
      }
      return result
    },
    [runAction, setLoadedBackground, notify],
  )

  const deleteBackground = useCallback(
    async (kind: BackgroundKind) => {
      const result = await runAction(kind, 'removing', removeBackground(kind))
      if (result.success) {
        setLoadedBackground(kind, null)
        notify(`${BACKGROUND_COPY[kind].title} background removed.`)
      }
      return result
    },
    [runAction, setLoadedBackground, notify],
  )

  return { loadState, retry, busyActions, saveBackground, deleteBackground }
}
