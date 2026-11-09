// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../lib/api'
import {
  BACKGROUND_HEADERS,
  LOGIN_REQUEST_LIST_PATH,
  loginRequestListsBody,
  makeLoginRequest,
} from '../../test/login-request-fixtures'
import { TestProviders } from '../../test/test-providers'
import type { LoginRequest } from '../../types'
import { useLoginRequests } from './use-login-requests'

const POLL_INTERVAL_MS = 3000
const EXPIRED_MESSAGE = 'This request expired. Ask the student to request again.'
const DECIDED_AT = '2026-11-05T10:06:00.000Z'

const firstPending = makeLoginRequest(1)
const secondPending = makeLoginRequest(2)
const deniedFirst = makeLoginRequest(1, { status: 'denied', decidedAt: DECIDED_AT })
const approvedFirst = makeLoginRequest(1, {
  status: 'approved',
  time: { mode: 'open-time' },
  decidedAt: DECIDED_AT,
})

// Every call without a queued answer fails the test visibly instead of hanging on an undefined response.
function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>(() =>
    Promise.resolve(Response.json({ error: 'Unexpected request in test.' }, { status: 500 })),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function listResponse(pending: LoginRequest[]) {
  return Response.json(loginRequestListsBody(pending))
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

// Only timers are faked, and waitFor is avoided here because its own drain step relies on setTimeout.
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function renderLoginRequests() {
  return renderHook(() => useLoginRequests(), { wrapper: TestProviders })
}

describe('useLoginRequests', () => {
  let fetchMock: ReturnType<typeof stubFetch>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fetchMock = stubFetch()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('loading and polling', () => {
    it('loads the lists with a normal request', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      const { result } = renderLoginRequests()
      await advance(0)

      expect(result.current.loadState).toEqual({ status: 'loaded' })
      expect(result.current.pending).toEqual([firstPending])
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0]?.[0]).toBe(LOGIN_REQUEST_LIST_PATH)
      expect(fetchMock.mock.calls[0]?.[1]?.headers).toBeUndefined()
    })

    it('shows the load error when the first load fails', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ error: 'Database is down.' }, { status: 500 }))
      const { result } = renderLoginRequests()
      await advance(0)

      expect(result.current.loadState).toEqual({ status: 'error', error: 'Database is down.' })
    })

    it('polls every three seconds as background refreshes', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      renderLoginRequests()
      await advance(0)

      await advance(POLL_INTERVAL_MS - 1)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await advance(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual(BACKGROUND_HEADERS)
    })

    it('replaces the list with the data from each poll', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      fetchMock.mockResolvedValueOnce(listResponse([firstPending, secondPending]))
      const { result } = renderLoginRequests()
      await advance(0)

      await advance(POLL_INTERVAL_MS)
      expect(result.current.pending).toEqual([firstPending, secondPending])
    })

    it('does not start a poll while the previous one is still running', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      const slowPoll = deferredResponse()
      fetchMock.mockReturnValueOnce(slowPoll.promise)
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      renderLoginRequests()
      await advance(0)

      await advance(POLL_INTERVAL_MS * 5)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      await act(async () => {
        slowPoll.resolve(listResponse([firstPending]))
        await vi.advanceTimersByTimeAsync(0)
      })
      await advance(POLL_INTERVAL_MS)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('keeps the last list when a poll fails and keeps polling', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      fetchMock.mockResolvedValueOnce(listResponse([firstPending, secondPending]))
      const { result } = renderLoginRequests()
      await advance(0)

      await advance(POLL_INTERVAL_MS)
      expect(result.current.pending).toEqual([firstPending])
      expect(result.current.loadState).toEqual({ status: 'loaded' })

      await advance(POLL_INTERVAL_MS)
      expect(result.current.pending).toEqual([firstPending, secondPending])
    })

    it('stops polling when unmounted', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      const { unmount } = renderLoginRequests()
      await advance(0)

      unmount()
      await advance(POLL_INTERVAL_MS * 10)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('decisions', () => {
    it('moves an approved request to history', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending, secondPending]))
      fetchMock.mockResolvedValueOnce(Response.json(approvedFirst))
      const { result } = renderLoginRequests()
      await advance(0)

      let outcome: ApiResult<unknown> | undefined
      await act(async () => {
        outcome = await result.current.approve(firstPending, { mode: 'open-time' })
      })

      expect(outcome).toEqual({ success: true, data: approvedFirst })
      expect(result.current.pending).toEqual([secondPending])
      expect(result.current.history).toEqual([approvedFirst])
      expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/login-requests/1/approve')
    })

    it('returns the server message when approval is refused as expired', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending]))
      fetchMock.mockResolvedValueOnce(Response.json({ error: EXPIRED_MESSAGE }, { status: 409 }))
      const { result } = renderLoginRequests()
      await advance(0)

      let outcome: ApiResult<unknown> | undefined
      await act(async () => {
        outcome = await result.current.approve(firstPending, { mode: 'time-limit', minutes: 30 })
      })

      expect(outcome).toEqual({ success: false, status: 409, error: EXPIRED_MESSAGE })
      expect(result.current.pending).toEqual([firstPending])
      expect(result.current.busyRequestIds).toEqual([])
    })

    it('does not bring back a request decided while a poll was in flight', async () => {
      fetchMock.mockResolvedValueOnce(listResponse([firstPending, secondPending]))
      const stalePoll = deferredResponse()
      fetchMock.mockReturnValueOnce(stalePoll.promise)
      fetchMock.mockResolvedValueOnce(Response.json(deniedFirst))
      const { result } = renderLoginRequests()
      await advance(0)

      await advance(POLL_INTERVAL_MS)
      await act(async () => {
        await result.current.deny(firstPending)
      })

      await act(async () => {
        stalePoll.resolve(listResponse([firstPending, secondPending]))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(result.current.pending).toEqual([secondPending])
      expect(result.current.history).toEqual([deniedFirst])
    })
  })
})
