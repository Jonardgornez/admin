import { useEffect, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { startPollLoop } from '../../lib/poll-loop'
import type { LoginRequestLists } from '../../lib/requests-api'
import * as requestsApi from '../../lib/requests-api'
import { useAuth } from '../auth/auth-context'
import { useSessionRequest } from '../auth/use-session-request'

export const PENDING_COUNT_POLL_INTERVAL_MS = 5000

// Each poll sets the count from the pending list. A failed poll keeps the last count.
export function startPendingCountPolling(
  fetchLists: () => Promise<ApiResult<LoginRequestLists>>,
  onCount: (count: number) => void,
  intervalMs: number,
): () => void {
  return startPollLoop(async () => {
    const result = await fetchLists()
    if (result.success) onCount(result.data.pending.length)
  }, intervalMs)
}

// Polls in the background, so an idle admin's session can still time out. Only runs while signed in.
export function usePendingRequestCount(): number {
  const request = useSessionRequest()
  const { state } = useAuth()
  const isSignedIn = state.status === 'signed-in'
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!isSignedIn) return
    return startPendingCountPolling(
      () => request(requestsApi.listLoginRequests({ isBackground: true })),
      setPendingCount,
      PENDING_COUNT_POLL_INTERVAL_MS,
    )
  }, [isSignedIn, request])

  return pendingCount
}
