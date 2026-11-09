import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startPollLoop } from './poll-loop'

const INTERVAL_MS = 3000

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('startPollLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the poll right away', () => {
    const poll = vi.fn(() => Promise.resolve())
    startPollLoop(poll, INTERVAL_MS)
    expect(poll).toHaveBeenCalledTimes(1)
  })

  it('runs again one interval after each run', async () => {
    const poll = vi.fn(() => Promise.resolve())
    startPollLoop(poll, INTERVAL_MS)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS - 1)
    expect(poll).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(poll).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(poll).toHaveBeenCalledTimes(3)
  })

  it('waits for a slow poll to finish before scheduling the next one', async () => {
    const slowRun = deferred()
    const poll = vi.fn(() => slowRun.promise)
    startPollLoop(poll, INTERVAL_MS)

    await vi.advanceTimersByTimeAsync(10 * INTERVAL_MS)
    expect(poll).toHaveBeenCalledTimes(1)

    slowRun.resolve()
    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(poll).toHaveBeenCalledTimes(2)
  })

  it('stops scheduling when stopped between runs', async () => {
    const poll = vi.fn(() => Promise.resolve())
    const stop = startPollLoop(poll, INTERVAL_MS)
    await vi.advanceTimersByTimeAsync(0)

    stop()
    await vi.advanceTimersByTimeAsync(10 * INTERVAL_MS)
    expect(poll).toHaveBeenCalledTimes(1)
  })

  it('does not schedule another run when stopped during a poll', async () => {
    const slowRun = deferred()
    const poll = vi.fn(() => slowRun.promise)
    const stop = startPollLoop(poll, INTERVAL_MS)

    stop()
    slowRun.resolve()
    await vi.advanceTimersByTimeAsync(10 * INTERVAL_MS)
    expect(poll).toHaveBeenCalledTimes(1)
  })
})
