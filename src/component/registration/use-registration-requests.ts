import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import {
  isAlreadyAnswered,
  removeRegistrationRequest,
  type RegistrationAction,
} from '../../lib/registration-requests'
import {
  acceptRegistrationRequest,
  denyRegistrationRequest,
  listRegistrationRequests,
  type RegistrationRequest,
} from '../../lib/registration-requests-api'
import { useAuth } from '../auth/auth-context'
import { useSessionRequest } from '../auth/use-session-request'

export const POLL_INTERVAL_MS = 3000

export function useRegistrationRequests() {
  const request = useSessionRequest()
  const { state } = useAuth()
  const isSignedIn = state.status === 'signed-in'
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [isAnswering, setIsAnswering] = useState(false)
  const latestLoadId = useRef(0)
  // Checked synchronously so a double click cannot send the answer twice.
  const isAnsweringRef = useRef(false)

  // One poll at a time. The next one is scheduled only after the last response is in.
  useEffect(() => {
    if (!isSignedIn) return
    const loop = {
      isStopped: false,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    }

    async function poll() {
      const loadId = ++latestLoadId.current
      // Background requests do not extend the idle session.
      const result = await request(listRegistrationRequests({ isBackground: true }))
      // A failed poll stays quiet, and the list keeps what it had until the next poll.
      if (!loop.isStopped && result.success && loadId === latestLoadId.current) {
        setRequests(result.data)
      }
      if (!loop.isStopped) loop.timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      loop.isStopped = true
      clearTimeout(loop.timer)
    }
  }, [isSignedIn, request])

  // Resolves with null when another answer is already in progress.
  const answer = useCallback(
    async (
      entry: RegistrationRequest,
      action: RegistrationAction,
    ): Promise<ApiResult<undefined> | null> => {
      if (isAnsweringRef.current) return null
      isAnsweringRef.current = true
      setIsAnswering(true)
      // A poll in flight may still show this request, so its answer is discarded.
      latestLoadId.current++
      try {
        const result = await request(
          action === 'accept'
            ? acceptRegistrationRequest(entry.id)
            : denyRegistrationRequest(entry.id),
        )
        if (result.success || isAlreadyAnswered(result)) {
          setRequests((current) => removeRegistrationRequest(current, entry.id))
        }
        return result
      } finally {
        latestLoadId.current++
        isAnsweringRef.current = false
        setIsAnswering(false)
      }
    },
    [request],
  )

  return { requests, isAnswering, answer }
}
