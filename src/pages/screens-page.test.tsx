// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScreenConnectionOptions } from '../component/pc/screen-connection'
import type { ViewMode } from '../types'
import { makeServerPc } from '../test/screen-pc-fixtures'
import { TestProviders } from '../test/test-providers'
import { ScreensPage } from './screens-page'

// No socket is opened in these tests. The address of each one asked for is recorded.
const connections = vi.hoisted(() => ({ urls: [] as string[] }))

vi.mock('../component/pc/screen-connection', () => ({
  openScreenConnection: (options: ScreenConnectionOptions) => {
    connections.urls.push(options.url)
    return { close: vi.fn(), send: vi.fn(() => false) }
  },
}))

function settingsBody(defaultViewMode: ViewMode) {
  return {
    defaultApproval: { mode: 'time-limit', minutes: 60 },
    notice: { isEnabled: false, text: '' },
    idleTimeoutMinutes: 30,
    defaultViewMode,
    powerCountdownSeconds: 30,
    lockMessage: 'Locked.',
  }
}

const PCS_BODY = [makeServerPc(1, 'PC-1', true), makeServerPc(2, 'PC-2', false)]

// The settings answer comes from the given promise, so a test can hold it back.
function stubApi(settings: () => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      String(input) === '/api/settings' ? settings() : Promise.resolve(Response.json(PCS_BODY)),
    ),
  )
}

function CurrentSearch() {
  return <output aria-label="Address search">{useLocation().search}</output>
}

function renderPage(initialPath = '/screens') {
  render(
    <TestProviders initialPath={initialPath}>
      <ScreensPage />
      <CurrentSearch />
    </TestProviders>,
  )
}

function currentSearch(): string {
  return screen.getByLabelText('Address search').textContent ?? ''
}

function radio(name: string): HTMLInputElement {
  return screen.getByRole('radio', { name })
}

describe('ScreensPage', () => {
  beforeEach(() => {
    connections.urls = []
    stubApi(() => Promise.resolve(Response.json(settingsBody('notified'))))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('counts the online PCs and starts in notified mode at medium size', async () => {
    renderPage()

    expect(await screen.findByText('1 online')).toBeTruthy()
    expect(radio('Notified – the user sees a notice').checked).toBe(true)
    expect(radio('Medium').checked).toBe(true)
    expect(screen.getByRole('link', { name: /^PC-1 screen/ }).getAttribute('href')).toBe(
      '/pc/1/screen?mode=notified',
    )
  })

  it('reads the mode and size from the address', async () => {
    renderPage('/screens?mode=anonymous&size=large')

    await screen.findByText('1 online')
    expect(radio('Anonymous – no sign on the PC').checked).toBe(true)
    expect(radio('Large').checked).toBe(true)
    expect(screen.getByRole('link', { name: /^PC-1 screen/ }).getAttribute('href')).toBe(
      '/pc/1/screen?mode=anonymous',
    )
  })

  it('keeps each choice in the address', async () => {
    renderPage()
    await screen.findByText('1 online')

    fireEvent.click(radio('Anonymous – no sign on the PC'))
    fireEvent.click(radio('Small'))

    const params = new URLSearchParams(currentSearch())
    expect(params.get('mode')).toBe('anonymous')
    expect(params.get('size')).toBe('small')
  })

  it('shows offline PCs only after the box is ticked, and remembers it', async () => {
    renderPage()
    await screen.findByText('1 online')
    expect(screen.queryByText('PC-2')).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show offline PCs' }))

    expect(screen.getByText('PC-2')).toBeTruthy()
    expect(new URLSearchParams(currentSearch()).get('offline')).toBe('shown')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show offline PCs' }))

    expect(screen.queryByText('PC-2')).toBeNull()
    expect(new URLSearchParams(currentSearch()).has('offline')).toBe(false)
  })

  it('waits for the saved default mode before opening any tile, then uses it', async () => {
    let answerSettings: (response: Response) => void = () => undefined
    stubApi(() => new Promise((resolve) => (answerSettings = resolve)))
    renderPage()

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/pcs', expect.anything()))
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(screen.getByText('Loading PCs...')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^PC-1 screen/ })).toBeNull()
    expect(connections.urls).toEqual([])

    answerSettings(Response.json(settingsBody('anonymous')))

    const link = await screen.findByRole('link', { name: /^PC-1 screen/ })
    expect(link.getAttribute('href')).toBe('/pc/1/screen?mode=anonymous')
    expect(radio('Anonymous – no sign on the PC').checked).toBe(true)
    await waitFor(() => expect(connections.urls).toHaveLength(1))
    expect(connections.urls[0]).toMatch(/mode=anonymous&passive=1$/)
  })

  it('falls back to notified, with no error shown, when the settings fail to load', async () => {
    stubApi(() => Promise.resolve(Response.json({ error: 'Down' }, { status: 500 })))
    renderPage()

    const link = await screen.findByRole('link', { name: /^PC-1 screen/ })
    expect(link.getAttribute('href')).toBe('/pc/1/screen?mode=notified')
    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(connections.urls).toHaveLength(1))
    expect(connections.urls[0]).toMatch(/mode=notified&passive=1$/)
  })

  it('lets a mode in the address win over the saved default', async () => {
    stubApi(() => Promise.resolve(Response.json(settingsBody('anonymous'))))
    renderPage('/screens?mode=notified')

    const link = await screen.findByRole('link', { name: /^PC-1 screen/ })
    expect(link.getAttribute('href')).toBe('/pc/1/screen?mode=notified')
    await waitFor(() => expect(connections.urls).toHaveLength(1))
    expect(connections.urls[0]).toMatch(/mode=notified&passive=1$/)
  })
})
