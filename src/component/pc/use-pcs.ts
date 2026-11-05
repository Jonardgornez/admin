import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import { toSortedRegisteredPcs } from '../../lib/pcs'
import * as pcsApi from '../../lib/pcs-api'
import type { RegisteredPc, ServerPc } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'

export const POLL_INTERVAL_MS = 5000
const NOT_FOUND_STATUS = 404
const CONFLICT_STATUS = 409

export type PcsLoadState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; error: string }

type PcsResult = ApiResult<ServerPc[]>

export function usePcs() {
  const request = useSessionRequest()
  const [pcs, setPcs] = useState<RegisteredPc[]>([])
  const [loadState, setLoadState] = useState<PcsLoadState>({ status: 'loading' })
  const [isDisconnected, setIsDisconnected] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [removingPcIds, setRemovingPcIds] = useState<number[]>([])
  const latestLoadId = useRef(0)
  const hasLoaded = useRef(false)
  const refreshNow = useRef<((isBackground: boolean) => Promise<void>) | null>(null)

  // Resolves with null when a newer load or a removal started since, so the answer is stale.
  const fetchPcs = useCallback(
    async (isBackground: boolean): Promise<PcsResult | null> => {
      const loadId = ++latestLoadId.current
      const result = await request(pcsApi.listPcs({ isBackground }))
      return loadId === latestLoadId.current ? result : null
    },
    [request],
  )

  const applyResult = useCallback((result: PcsResult | null) => {
    if (!result) return
    if (result.success) {
      hasLoaded.current = true
      const now = new Date()
      setPcs(toSortedRegisteredPcs(result.data, now))
      setLoadState({ status: 'loaded' })
      setIsDisconnected(false)
      setLastUpdatedAt(now)
      return
    }
    // An expired session is handled by the sign-out redirect.
    if (isSessionExpired(result)) return
    if (hasLoaded.current) setIsDisconnected(true)
    else setLoadState({ status: 'error', error: result.error })
  }, [])

  // One request at a time: the next poll is only scheduled once the last response is in.
  useEffect(() => {
    const loop = {
      isStopped: false,
      inFlightCount: 0,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    }

    function scheduleNextPoll() {
      clearTimeout(loop.timer)
      if (loop.isStopped || document.hidden || loop.inFlightCount > 0) return
      loop.timer = setTimeout(() => void refresh(true), POLL_INTERVAL_MS)
    }

    async function refresh(isBackground: boolean) {
      clearTimeout(loop.timer)
      loop.inFlightCount++
      try {
        const result = await fetchPcs(isBackground)
        if (!loop.isStopped) applyResult(result)
      } finally {
        loop.inFlightCount--
        scheduleNextPoll()
      }
    }

    function refreshWhenVisible() {
      if (!document.hidden && loop.inFlightCount === 0) void refresh(true)
    }

    refreshNow.current = refresh
    document.addEventListener('visibilitychange', refreshWhenVisible)
    // The first load counts as activity; polls after it must not extend the session.
    void refresh(hasLoaded.current)

    return () => {
      loop.isStopped = true
      clearTimeout(loop.timer)
      refreshNow.current = null
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [fetchPcs, applyResult])

  const retry = useCallback(() => {
    setLoadState((current) => (current.status === 'error' ? { status: 'loading' } : current))
    void refreshNow.current?.(false)
  }, [])

  const removePc = useCallback(
    async (pc: RegisteredPc): Promise<ApiResult<undefined>> => {
      setRemovingPcIds((current) => [...current, pc.id])
      try {
        const result = await request(pcsApi.removePc(pc.id))
        if (result.success) {
          // A list requested before the removal would bring the PC back.
          latestLoadId.current++
          setPcs((current) => current.filter((candidate) => candidate.id !== pc.id))
        } else if (result.status === NOT_FOUND_STATUS || result.status === CONFLICT_STATUS) {
          void refreshNow.current?.(true)
        }
        return result
      } finally {
        setRemovingPcIds((current) => current.filter((id) => id !== pc.id))
      }
    },
    [request],
  )

  return { pcs, loadState, isDisconnected, lastUpdatedAt, removingPcIds, retry, removePc }
}
