// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FakeIntersectionObserver,
  setAllObservedOnScreen,
} from '../../test/intersection-observer'
import { TILE_ELSEWHERE_RETRY_MS } from '../../lib/screen-grid'
import { TestProviders } from '../../test/test-providers'
import type { ScreenConnectionOptions } from '../pc/screen-connection'
import { ScreenTile } from './screen-tile'
import { TILE_HIDE_DELAY_MS, TILE_SHOW_DELAY_MS } from './use-screen-tile'

interface OpenedConnection {
  options: ScreenConnectionOptions
  close: ReturnType<typeof vi.fn>
}

// Each opened connection is recorded, so a test can play the server's side through its callbacks.
const connections = vi.hoisted(() => ({ opened: [] as OpenedConnection[] }))

vi.mock('../pc/screen-connection', () => ({
  openScreenConnection: (options: ScreenConnectionOptions) => {
    const opened = { options, close: vi.fn() }
    connections.opened.push(opened)
    return { close: opened.close, send: vi.fn(() => true) }
  },
}))

let isDocumentHidden = false

function latestConnection(): OpenedConnection {
  const latest = connections.opened.at(-1)
  if (!latest) throw new Error('No connection was opened')
  return latest
}

function renderTile(mode: 'notified' | 'anonymous' = 'notified') {
  return render(
    <TestProviders>
      <ul>
        <ScreenTile pcId={3} pcName="PC-3" mode={mode} />
      </ul>
    </TestProviders>,
  )
}

function showTile() {
  act(() => setAllObservedOnScreen(true))
  act(() => vi.advanceTimersByTime(TILE_SHOW_DELAY_MS))
}

function setDocumentHidden(isHidden: boolean) {
  isDocumentHidden = isHidden
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

describe('ScreenTile', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    connections.opened = []
    FakeIntersectionObserver.instances = []
    isDocumentHidden = false
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => isDocumentHidden })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('connects only once on screen, with a one second ack delay and the chosen mode', () => {
    renderTile('anonymous')
    expect(connections.opened).toHaveLength(0)

    showTile()

    expect(connections.opened).toHaveLength(1)
    expect(latestConnection().options.ackDelayMs).toBe(1000)
    expect(latestConnection().options.url).toMatch(/\/api\/pcs\/3\/screen\/live\?mode=anonymous&passive=1$/)
  })

  it('links to the full view in the same mode and names the status', () => {
    renderTile('anonymous')
    showTile()

    act(() => latestConnection().options.onServerState('live'))

    const link = screen.getByRole('link', { name: 'PC-3 screen, live' })
    expect(link.getAttribute('href')).toBe('/pc/3/screen?mode=anonymous')
  })

  it.each([
    ['waiting', 'Waiting for the PC'],
    ['live', 'Live'],
    ['paused', 'Paused'],
    ['secure', 'PC reports a protected screen'],
  ] as const)('shows the %s state', (state, label) => {
    renderTile()
    showTile()

    act(() => latestConnection().options.onServerState(state))

    expect(screen.getByText(label)).toBeTruthy()
  })

  it('opens passively, so it never replaces another view', () => {
    renderTile()
    showTile()

    expect(latestConnection().options.url).toMatch(/\?mode=notified&passive=1$/)
  })

  it.each([
    ['a refused upgrade (409)', 1006, false],
    ['a busy close (4005)', 4005, true],
    ['a replaced close (4001)', 4001, true],
  ] as const)(
    'shows the PC open elsewhere after %s, and checks again passively every 10 s',
    (_, code, wasOpen) => {
      renderTile()
      showTile()

      act(() => latestConnection().options.onClose(code, wasOpen))

      expect(screen.getByText('Open in full view elsewhere')).toBeTruthy()
      expect(
        screen.getByRole('link', { name: 'PC-3 screen, open in full view elsewhere' }),
      ).toBeTruthy()
      act(() => vi.advanceTimersByTime(TILE_ELSEWHERE_RETRY_MS - 1))
      expect(connections.opened).toHaveLength(1)
      act(() => vi.advanceTimersByTime(1))
      expect(connections.opened).toHaveLength(2)
      expect(latestConnection().options.url).toMatch(/passive=1$/)

      act(() => latestConnection().options.onServerState('live'))
      expect(screen.queryByText('Open in full view elsewhere')).toBeNull()
    },
  )

  it('does not check again while off screen', () => {
    renderTile()
    showTile()
    act(() => latestConnection().options.onClose(4005, true))

    act(() => setAllObservedOnScreen(false))
    act(() => vi.advanceTimersByTime(TILE_HIDE_DELAY_MS + TILE_ELSEWHERE_RETRY_MS * 2))

    expect(connections.opened).toHaveLength(1)
  })

  it('takes over once with a full view, then goes back to passive', () => {
    renderTile()
    showTile()
    act(() => latestConnection().options.onClose(4005, true))

    fireEvent.click(screen.getByRole('button', { name: 'Take over PC-3' }))

    expect(connections.opened).toHaveLength(2)
    expect(latestConnection().options.url).not.toMatch(/passive/)
    act(() => latestConnection().options.onServerState('live'))
    expect(connections.opened).toHaveLength(2)

    act(() => latestConnection().options.onClose(1006, true))
    act(() => vi.advanceTimersByTime(1000))

    expect(connections.opened).toHaveLength(3)
    expect(latestConnection().options.url).toMatch(/passive=1$/)
  })

  it('goes back to passive when it scrolls back into view after taking over', () => {
    renderTile()
    showTile()
    act(() => latestConnection().options.onClose(4005, true))
    fireEvent.click(screen.getByRole('button', { name: 'Take over PC-3' }))

    act(() => setAllObservedOnScreen(false))
    act(() => vi.advanceTimersByTime(TILE_HIDE_DELAY_MS))
    showTile()

    expect(connections.opened).toHaveLength(3)
    expect(latestConnection().options.url).toMatch(/passive=1$/)
  })

  it('shows the refusal and Reconnect when a take over is refused', () => {
    renderTile()
    showTile()
    act(() => latestConnection().options.onClose(4005, true))
    fireEvent.click(screen.getByRole('button', { name: 'Take over PC-3' }))

    act(() => latestConnection().options.onClose(1006, false))

    expect(screen.getByText("Couldn't open the screen.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reconnect PC-3' })).toBeTruthy()
  })

  it('shows a short message and a passive Reconnect after another error', () => {
    renderTile()
    showTile()

    act(() => latestConnection().options.onClose(4002, true))

    expect(screen.getByText(/went offline or was removed/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'PC-3 screen, ended' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect PC-3' }))

    expect(connections.opened).toHaveLength(2)
    expect(latestConnection().options.url).toMatch(/passive=1$/)
  })

  it('retries a lost connection by itself', () => {
    renderTile()
    showTile()

    act(() => latestConnection().options.onClose(1006, true))
    act(() => vi.advanceTimersByTime(1000))

    expect(connections.opened).toHaveLength(2)
  })

  it('closes the connection off screen after the settle time, and reconnects back on screen', () => {
    renderTile()
    showTile()
    const first = latestConnection()

    act(() => setAllObservedOnScreen(false))
    act(() => vi.advanceTimersByTime(TILE_HIDE_DELAY_MS - 1))
    expect(first.close).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(first.close).toHaveBeenCalledTimes(1)

    showTile()
    expect(connections.opened).toHaveLength(2)
  })

  it('keeps the connection when the tile scrolls out and back in quickly', () => {
    renderTile()
    showTile()

    act(() => setAllObservedOnScreen(false))
    act(() => vi.advanceTimersByTime(TILE_HIDE_DELAY_MS / 2))
    showTile()
    act(() => vi.advanceTimersByTime(TILE_HIDE_DELAY_MS))

    expect(latestConnection().close).not.toHaveBeenCalled()
    expect(connections.opened).toHaveLength(1)
  })

  it('closes the connection while the tab is hidden and reconnects when it is shown', () => {
    renderTile()
    showTile()
    const first = latestConnection()

    setDocumentHidden(true)
    act(() => vi.advanceTimersByTime(TILE_HIDE_DELAY_MS))
    expect(first.close).toHaveBeenCalledTimes(1)

    setDocumentHidden(false)
    act(() => vi.advanceTimersByTime(TILE_SHOW_DELAY_MS))
    expect(connections.opened).toHaveLength(2)
  })

  it('reconnects with the new mode when the mode changes', () => {
    const { rerender } = renderTile('notified')
    showTile()
    const first = latestConnection()

    rerender(
      <TestProviders>
        <ul>
          <ScreenTile pcId={3} pcName="PC-3" mode="anonymous" />
        </ul>
      </TestProviders>,
    )

    expect(first.close).toHaveBeenCalledTimes(1)
    expect(latestConnection().options.url).toMatch(/mode=anonymous&passive=1$/)
  })
})
