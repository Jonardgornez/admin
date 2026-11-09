// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '../../lib/auth-state'
import {
  BACKGROUND_HEADERS,
  loginRequestListsBody,
  makeLoginRequest,
} from '../../test/login-request-fixtures'
import { TestProviders } from '../../test/test-providers'
import { PENDING_COUNT_POLL_INTERVAL_MS, usePendingRequestCount } from './use-pending-request-count'

const SIGNED_OUT: AuthState = { status: 'signed-out' }

function PendingCountProbe() {
  const pendingCount = usePendingRequestCount()
  return <output>{pendingCount}</output>
}

function listResponse(pendingCount: number, historyCount = 0) {
  return Response.json(
    loginRequestListsBody(
      Array.from({ length: pendingCount }, (_, index) => makeLoginRequest(index + 1)),
      Array.from({ length: historyCount }, (_, index) =>
        makeLoginRequest(100 + index, { status: 'denied', decidedAt: '2026-11-05T10:06:00.000Z' }),
      ),
    ),
  )
}

function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>(() =>
    Promise.resolve(Response.json({ error: 'Unexpected request in test.' }, { status: 500 })),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPendingCount(state?: AuthState) {
  return render(
    <TestProviders state={state}>
      <PendingCountProbe />
    </TestProviders>,
  )
}

function shownCount(): string | null {
  return screen.getByRole('status').textContent
}

// Only timers are faked, so the Response bodies can still be read.
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('usePendingRequestCount', () => {
  let fetchMock: ReturnType<typeof stubFetch>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fetchMock = stubFetch()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the number of pending requests, not the history', async () => {
    fetchMock.mockResolvedValueOnce(listResponse(2, 3))
    renderPendingCount()
    await advance(0)

    expect(shownCount()).toBe('2')
  })

  it('polls every five seconds as background refreshes', async () => {
    fetchMock.mockResolvedValueOnce(listResponse(1))
    fetchMock.mockResolvedValueOnce(listResponse(4))
    renderPendingCount()
    await advance(0)

    await advance(PENDING_COUNT_POLL_INTERVAL_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await advance(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual(BACKGROUND_HEADERS)
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual(BACKGROUND_HEADERS)
    expect(shownCount()).toBe('4')
  })

  it('keeps the last count when a poll fails', async () => {
    fetchMock.mockResolvedValueOnce(listResponse(2))
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    fetchMock.mockResolvedValueOnce(listResponse(5))
    renderPendingCount()
    await advance(0)

    await advance(PENDING_COUNT_POLL_INTERVAL_MS)
    expect(shownCount()).toBe('2')

    await advance(PENDING_COUNT_POLL_INTERVAL_MS)
    expect(shownCount()).toBe('5')
  })

  it('does not poll while signed out', async () => {
    renderPendingCount(SIGNED_OUT)
    await advance(PENDING_COUNT_POLL_INTERVAL_MS * 4)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(shownCount()).toBe('0')
  })

  it('stops polling when the admin signs out', async () => {
    fetchMock.mockResolvedValueOnce(listResponse(1))
    const { rerender } = renderPendingCount()
    await advance(0)

    rerender(
      <TestProviders state={SIGNED_OUT}>
        <PendingCountProbe />
      </TestProviders>,
    )
    await advance(PENDING_COUNT_POLL_INTERVAL_MS * 10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops polling when unmounted', async () => {
    fetchMock.mockResolvedValueOnce(listResponse(1))
    const { unmount } = renderPendingCount()
    await advance(0)

    unmount()
    await advance(PENDING_COUNT_POLL_INTERVAL_MS * 10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
