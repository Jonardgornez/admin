import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { addToHistory, removeRequests } from '../../lib/requests'
import * as requestsApi from '../../lib/requests-api'
import { startPollLoop } from '../../lib/poll-loop'
import type { ApprovalChoice, LoginRequest } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'

const NOT_FOUND_STATUS = 404
const CONFLICT_STATUS = 409
const POLL_INTERVAL_MS = 3000

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
  const fetchLists = useCallback(
    async (isBackground: boolean): Promise<ListsResult | null> => {
      const loadId = ++latestLoadId.current
      const result = await request(requestsApi.listLoginRequests({ isBackground }))
      return loadId === latestLoadId.current ? result : null
    },
    [request],
  )

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
    applyInitialLoad(await fetchLists(false))
  }, [fetchLists, applyInitialLoad])

  // The list stays visible while this runs, and a failure leaves it as it was.
  const refresh = useCallback(async (): Promise<ApiResult<unknown>> => {
    setIsRefreshing(true)
    try {
      const result = await fetchLists(false)
      applyLists(result)
      return result ?? NO_FAILURE
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchLists, applyLists])

  // The first run is the normal load and later runs are background polls. A failed poll
  // is quiet, so the list keeps what it had until the next poll.
  useEffect(() => {
    const loop = { isFirstRun: true, isActive: true }
    const stopPolling = startPollLoop(async () => {
      const isInitialLoad = loop.isFirstRun
      loop.isFirstRun = false
      const result = await fetchLists(!isInitialLoad)
      if (!loop.isActive) return
      if (isInitialLoad) applyInitialLoad(result)
      else applyLists(result)
    }, POLL_INTERVAL_MS)
    return () => {
      loop.isActive = false
      stopPolling()
    }
  }, [fetchLists, applyInitialLoad, applyLists])

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
      if (isChangedElsewhere) void fetchLists(false).then(applyLists)
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
        return result
      }),
    [runForRequests, request, moveToHistory],
  )

  // A refused approval is not re-read here. The card keeps the server's message, and the next
  // poll moves the request to history.
  const approve = useCallback(
    (loginRequest: LoginRequest, time: ApprovalChoice) =>
      decide(loginRequest.id, requestsApi.approveLoginRequest(loginRequest.id, time)),
    [decide],
  )

  const deny = useCallback(
    async (loginRequest: LoginRequest) => {
      const result = await decide(loginRequest.id, requestsApi.denyLoginRequest(loginRequest.id))
      refreshIfChangedElsewhere(result)
      return result
    },
    [decide, refreshIfChangedElsewhere],
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
            if (result.data.length < ids.length) void fetchLists(false).then(applyLists)
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
