// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTransfer } from '../../test/file-transfer-fixtures'
import { TestProviders } from '../../test/test-providers'
import type { FileTransfer } from '../../types'
import { FILE_TRANSFER_POLL_INTERVAL_MS, useFileTransfers } from './use-file-transfers'

const LATER = '2026-11-18T10:05:00Z'

function stubFetch(...replies: Array<() => Response>) {
  let call = 0
  const fetchMock = vi.fn<typeof fetch>(() => {
    const reply = replies[Math.min(call, replies.length - 1)]
    call++
    return Promise.resolve(reply())
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function transfersReply(transfers: FileTransfer[]) {
  return () => Response.json({ transfers })
}

function renderTransfers(initial: FileTransfer[]) {
  const wrapper = ({ children }: { children: ReactNode }) => <TestProviders>{children}</TestProviders>
  return renderHook(() => useFileTransfers(initial), { wrapper })
}

// One act per interval, so React re-renders between polls as it would in the browser.
async function advancePoll(times = 1) {
  for (let run = 0; run < times; run++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FILE_TRANSFER_POLL_INTERVAL_MS)
    })
  }
}

describe('useFileTransfers', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('polls the transfers every 2 seconds as background reads and shows the update', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = stubFetch(transfersReply([makeTransfer(1, { status: 'downloading', updatedUtc: LATER })]))
    const { result } = renderTransfers([makeTransfer(1)])

    await advancePoll()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/pcs/files/transfers?ids=1')
    expect(init.headers).toEqual({ 'X-Background-Refresh': '1' })
    expect(result.current.transfers[0].status).toBe('downloading')
  })

  it('stops polling once every transfer is final', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = stubFetch(transfersReply([makeTransfer(1, { status: 'saved', updatedUtc: LATER })]))
    const { result } = renderTransfers([makeTransfer(1)])

    await advancePoll(4)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.isPending).toBe(false)
  })

  it('does not poll when every transfer is already final', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = stubFetch(transfersReply([]))
    renderTransfers([makeTransfer(1, { status: 'failed' })])

    await advancePoll(3)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops polling when unmounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = stubFetch(transfersReply([makeTransfer(1)]))
    const { unmount } = renderTransfers([makeTransfer(1)])

    unmount()
    await advancePoll(3)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the last status and says so when a poll fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    stubFetch(() => Response.json({ error: 'Busy.' }, { status: 500 }))
    const { result } = renderTransfers([makeTransfer(1)])

    await advancePoll()

    expect(result.current.transfers[0].status).toBe('waiting')
    expect(result.current.pollError).toBe("Can't refresh the status right now. Trying again.")
  })

  it('posts a decision and shows the returned transfers', async () => {
    const fetchMock = stubFetch(
      transfersReply([makeTransfer(1, { status: 'applying', decision: 'overwrite', updatedUtc: LATER })]),
    )
    const { result } = renderTransfers([makeTransfer(1, { status: 'exists' })])

    await act(async () => {
      await result.current.decide([1], 'overwrite')
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/pcs/files/transfers/decision')
    expect(result.current.transfers[0].status).toBe('applying')
    expect(result.current.isDeciding).toBe(false)
  })

  it('shows the error when a decision fails', async () => {
    stubFetch(() => Response.json({ error: 'Transfer not found.' }, { status: 404 }))
    const { result } = renderTransfers([makeTransfer(1, { status: 'exists' })])

    await act(async () => {
      await result.current.decide([1], 'skip')
    })

    expect(result.current.decisionError).toBe('Transfer not found.')
  })
})
