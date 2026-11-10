// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestProviders } from '../../test/test-providers'
import type { SessionLog, SessionLogPage } from '../../types'
import { useSessionLogs, type SessionLogQuery } from './use-session-logs'

function makeLog(id: number): SessionLog {
  return {
    id,
    pcName: `PC-${String(id).padStart(2, '0')}`,
    userOrSource: 'lab',
    source: 'account',
    startedAt: '2026-11-04T09:30:00.000Z',
    endedAt: null,
    durationMinutes: 5,
    endReason: null,
  }
}

function pageBody(items: SessionLog[], page = 1): SessionLogPage {
  return { items, totalItems: items.length, page, pageSize: 10 }
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function stubFetch() {
  const fetchMock = vi.fn<typeof fetch>(() =>
    Promise.resolve(Response.json({ error: 'Unexpected request in test.' }, { status: 500 })),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const ALL_SESSIONS: SessionLogQuery = { filters: {}, page: 1 }
const PC_SESSIONS: SessionLogQuery = { filters: { pc: 'PC-02' }, page: 1 }

function renderSessionLogs(query: SessionLogQuery) {
  return renderHook((props: SessionLogQuery) => useSessionLogs(props), {
    wrapper: TestProviders,
    initialProps: query,
  })
}

describe('useSessionLogs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts loading and then holds the page it fetched', async () => {
    stubFetch().mockResolvedValueOnce(Response.json(pageBody([makeLog(1)])))
    const { result } = renderSessionLogs(ALL_SESSIONS)

    expect(result.current.loadState).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current.loadState).toEqual({ status: 'loaded' }))
    expect(result.current.data).toEqual(pageBody([makeLog(1)]))
  })

  it('sends the applied filters and page to the server', async () => {
    const fetchMock = stubFetch().mockResolvedValueOnce(Response.json(pageBody([])))
    renderSessionLogs({ filters: { pc: 'PC-02', user: 'lab' }, page: 3 })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/session-logs?pc=PC-02&user=lab&page=3&pageSize=10')
  })

  it('shows the server message when the load fails', async () => {
    stubFetch().mockResolvedValueOnce(
      Response.json({ error: 'pc must be 64 characters or fewer.' }, { status: 400 }),
    )
    const { result } = renderSessionLogs(ALL_SESSIONS)

    await waitFor(() =>
      expect(result.current.loadState).toEqual({
        status: 'error',
        error: 'pc must be 64 characters or fewer.',
      }),
    )
    expect(result.current.data).toBeNull()
  })

  it('does not show an error when the session has expired', async () => {
    stubFetch().mockResolvedValueOnce(Response.json({ error: 'Sign in again.' }, { status: 401 }))
    const { result } = renderSessionLogs(ALL_SESSIONS)

    await act(async () => {
      await new Promise((done) => setTimeout(done, 0))
    })
    expect(result.current.loadState).toEqual({ status: 'loading' })
    expect(result.current.data).toBeNull()
  })

  it('loads again when reload is called', async () => {
    const fetchMock = stubFetch()
      .mockResolvedValueOnce(Response.json({ error: 'Database is down.' }, { status: 500 }))
      .mockResolvedValueOnce(Response.json(pageBody([makeLog(2)])))
    const { result } = renderSessionLogs(ALL_SESSIONS)
    await waitFor(() => expect(result.current.loadState.status).toBe('error'))

    await act(async () => {
      await result.current.reload()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.loadState).toEqual({ status: 'loaded' })
    expect(result.current.data).toEqual(pageBody([makeLog(2)]))
  })

  it('loads the new page when the query changes', async () => {
    const fetchMock = stubFetch()
      .mockResolvedValueOnce(Response.json(pageBody([makeLog(1)])))
      .mockResolvedValueOnce(Response.json(pageBody([makeLog(2)], 2)))
    const { result, rerender } = renderSessionLogs(ALL_SESSIONS)
    await waitFor(() => expect(result.current.loadState.status).toBe('loaded'))

    rerender({ filters: {}, page: 2 })

    await waitFor(() => expect(result.current.data?.page).toBe(2))
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/session-logs?page=2&pageSize=10')
  })

  it('ignores a slow response for an older query', async () => {
    const slowFirst = deferredResponse()
    const fetchMock = stubFetch()
      .mockReturnValueOnce(slowFirst.promise)
      .mockResolvedValueOnce(Response.json(pageBody([makeLog(2)])))
    const { result, rerender } = renderSessionLogs(ALL_SESSIONS)

    rerender(PC_SESSIONS)
    await waitFor(() => expect(result.current.data).toEqual(pageBody([makeLog(2)])))

    await act(async () => {
      slowFirst.resolve(Response.json(pageBody([makeLog(1)])))
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual(pageBody([makeLog(2)]))
    expect(result.current.loadState).toEqual({ status: 'loaded' })
  })

  it('ignores a slow error for an older query', async () => {
    const slowFirst = deferredResponse()
    stubFetch()
      .mockReturnValueOnce(slowFirst.promise)
      .mockResolvedValueOnce(Response.json(pageBody([makeLog(2)])))
    const { result, rerender } = renderSessionLogs(ALL_SESSIONS)

    rerender(PC_SESSIONS)
    await waitFor(() => expect(result.current.loadState).toEqual({ status: 'loaded' }))

    await act(async () => {
      slowFirst.resolve(Response.json({ error: 'Database is down.' }, { status: 500 }))
      await Promise.resolve()
    })

    expect(result.current.loadState).toEqual({ status: 'loaded' })
  })
})
