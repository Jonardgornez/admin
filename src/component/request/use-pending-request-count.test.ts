import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listLoginRequests } from '../../lib/requests-api'
import { PENDING_COUNT_POLL_INTERVAL_MS, startPendingCountPolling } from './use-pending-request-count'

const pendingEntry = {
  id: 1,
  pcName: 'PC-01',
  requestedAt: '2026-11-05T10:00:00.000Z',
  status: 'pending',
  decidedAt: null,
}

function listResponse(pendingCount: number, historyCount = 0) {
  return Response.json({
    pending: Array.from({ length: pendingCount }, (_, index) => ({
      ...pendingEntry,
      id: index + 1,
    })),
    history: Array.from({ length: historyCount }, (_, index) => ({
      ...pendingEntry,
      id: 100 + index,
      status: 'denied',
    })),
  })
}

// A Response body can only be read once, so each call gets a fresh one.
function stubFetchWith(makeResponse: () => Response | Error) {
  const fetchMock = vi.fn(() => {
    const response = makeResponse()
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function startCountPolling(onCount: (count: number) => void) {
  return startPendingCountPolling(
    () => listLoginRequests({ isBackground: true }),
    onCount,
    PENDING_COUNT_POLL_INTERVAL_MS,
  )
}

describe('startPendingCountPolling', () => {
  beforeEach(() => {
    // Only timers are faked, so Response.json can still read its body.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reports the number of pending requests, not the history', async () => {
    stubFetchWith(() => listResponse(3, 4))
    const onCount = vi.fn()
    const stop = startCountPolling(onCount)
    await vi.advanceTimersByTimeAsync(0)

    expect(onCount).toHaveBeenLastCalledWith(3)
    stop()
  })

  it('reports zero when nothing is waiting', async () => {
    stubFetchWith(() => listResponse(0, 2))
    const onCount = vi.fn()
    const stop = startCountPolling(onCount)
    await vi.advanceTimersByTimeAsync(0)

    expect(onCount).toHaveBeenLastCalledWith(0)
    stop()
  })

  it('sends each poll as a background request', async () => {
    const fetchMock = stubFetchWith(() => listResponse(1))
    const stop = startCountPolling(vi.fn())
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/login-requests',
      expect.objectContaining({ headers: { 'X-Background-Refresh': '1' } }),
    )
    stop()
  })

  it('polls again five seconds later and reports the new count', async () => {
    let pendingCount = 1
    const fetchMock = stubFetchWith(() => listResponse(pendingCount))
    const onCount = vi.fn()
    const stop = startCountPolling(onCount)
    await vi.advanceTimersByTimeAsync(0)

    pendingCount = 4
    await vi.advanceTimersByTimeAsync(PENDING_COUNT_POLL_INTERVAL_MS)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onCount).toHaveBeenLastCalledWith(4)
    stop()
  })

  it('keeps the last count when a poll fails', async () => {
    let shouldFail = false
    stubFetchWith(() => (shouldFail ? new TypeError('Failed to fetch') : listResponse(2)))
    const onCount = vi.fn()
    const stop = startCountPolling(onCount)
    await vi.advanceTimersByTimeAsync(0)

    shouldFail = true
    await vi.advanceTimersByTimeAsync(PENDING_COUNT_POLL_INTERVAL_MS)

    expect(onCount).toHaveBeenCalledTimes(1)
    expect(onCount).toHaveBeenLastCalledWith(2)
    stop()
  })

  it('stops polling once stopped', async () => {
    const fetchMock = stubFetchWith(() => listResponse(1))
    const stop = startCountPolling(vi.fn())
    await vi.advanceTimersByTimeAsync(0)

    stop()
    await vi.advanceTimersByTimeAsync(10 * PENDING_COUNT_POLL_INTERVAL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
