import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { addToHistory, removeRequests } from '../../lib/requests'
import * as requestsApi from '../../lib/requests-api'
import type { ApprovalChoice, LoginRequest } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'

const NOT_FOUND_STATUS = 404
const CONFLICT_STATUS = 409

export type LoginRequestsLoadState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; error: string }

const NO_FAILURE: ApiResult<undefined> = { success: true, data: undefined }

type ListsResult = ApiResult<requestsApi.LoginRequestLists>

export function useLoginRequests() {
  const request = useSessionRequest()
  const [pending, setPending] = useState<LoginRequest[]>([])
  const [history, setHistory] = useState<LoginRequest[]>([])
  const [now, setNow] = useState(() => new Date())
  const [loadState, setLoadState] = useState<LoginRequestsLoadState>({ status: 'loading' })
  const [busyRequestIds, setBusyRequestIds] = useState<number[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDenyingAll, setIsDenyingAll] = useState(false)
  const latestLoadId = useRef(0)

  // Resolves with null when a newer load or a change started since, so the answer is stale.
  const fetchLists = useCallback(async (): Promise<ListsResult | null> => {
    const loadId = ++latestLoadId.current
    const result = await request(requestsApi.listLoginRequests())
    return loadId === latestLoadId.current ? result : null
  }, [request])

  const applyLists = useCallback((result: ListsResult | null) => {
    if (!result?.success) return
    setPending(result.data.pending)
    setHistory(result.data.history)
    setNow(new Date())
    setLoadState({ status: 'loaded' })
  }, [])

  const showLoadError = useCallback((result: ListsResult | null) => {
    if (result && !result.success) setLoadState({ status: 'error', error: result.error })
  }, [])

  const applyInitialLoad = useCallback(
    (result: ListsResult | null) => {
      applyLists(result)
      showLoadError(result)
    },
    [applyLists, showLoadError],
  )

  const reload = useCallback(async () => {
    setLoadState({ status: 'loading' })
    applyInitialLoad(await fetchLists())
  }, [fetchLists, applyInitialLoad])

  // The list stays visible while this runs, and a failure leaves it as it was.
  const refresh = useCallback(async (): Promise<ApiResult<unknown>> => {
    setIsRefreshing(true)
    try {
      const result = await fetchLists()
      applyLists(result)
      return result ?? NO_FAILURE
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchLists, applyLists])

  useEffect(() => {
    void fetchLists().then(applyInitialLoad)
  }, [fetchLists, applyInitialLoad])

  // A list response requested before a change would undo that change on screen.
  const discardLoadsInFlight = useCallback(() => {
    latestLoadId.current++
  }, [])

  // Another tab already changed these, so refresh without a loading flash.
  const refreshIfChangedElsewhere = useCallback(
    (result: ApiResult<unknown>) => {
      const isChangedElsewhere =
        !result.success &&
        (result.status === NOT_FOUND_STATUS || result.status === CONFLICT_STATUS)
      if (isChangedElsewhere) void fetchLists().then(applyLists)
    },
    [fetchLists, applyLists],
  )

  const moveToHistory = useCallback(
    (entries: LoginRequest[]) => {
      discardLoadsInFlight()
      setNow(new Date())
      setPending((current) =>
        removeRequests(
          current,
          entries.map((entry) => entry.id),
        ),
      )
      setHistory((current) => addToHistory(current, entries))
    },
    [discardLoadsInFlight],
  )

  const runForRequests = useCallback(
    async <T,>(ids: number[], action: () => Promise<ApiResult<T>>) => {
      setBusyRequestIds((current) => [...current, ...ids])
      try {
        return await action()
      } finally {
        setBusyRequestIds((current) => current.filter((busyId) => !ids.includes(busyId)))
      }
    },
    [],
  )

  const decide = useCallback(
    (id: number, pendingDecision: Promise<ApiResult<LoginRequest>>) =>
      runForRequests([id], async () => {
        const result = await request(pendingDecision)
        if (result.success) moveToHistory([result.data])
        refreshIfChangedElsewhere(result)
        return result
      }),
    [runForRequests, request, moveToHistory, refreshIfChangedElsewhere],
  )

  const approve = useCallback(
    (loginRequest: LoginRequest, time: ApprovalChoice) =>
      decide(loginRequest.id, requestsApi.approveLoginRequest(loginRequest.id, time)),
    [decide],
  )

  const deny = useCallback(
    (loginRequest: LoginRequest) =>
      decide(loginRequest.id, requestsApi.denyLoginRequest(loginRequest.id)),
    [decide],
  )

  const denyAll = useCallback(
    async (ids: number[]) => {
      setIsDenyingAll(true)
      try {
        return await runForRequests(ids, async () => {
          const result = await request(requestsApi.denyLoginRequests(ids))
          if (result.success) {
            moveToHistory(result.data)
            // Some were already decided elsewhere, so the screen may be out of date.
            if (result.data.length < ids.length) void fetchLists().then(applyLists)
          }
          return result
        })
      } finally {
        setIsDenyingAll(false)
      }
    },
    [runForRequests, request, moveToHistory, fetchLists, applyLists],
  )

  return {
    pending,
    history,
    now,
    loadState,
    busyRequestIds,
    isRefreshing,
    isDenyingAll,
    reload,
    refresh,
    approve,
    deny,
    denyAll,
  }
}
