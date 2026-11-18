// @vitest-environment jsdom
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../component/auth/auth-context'
import type { RemoteControl } from '../component/pc/use-remote-control'
import type { ScreenStream } from '../component/pc/use-screen-stream'
import { NavigationLockContext } from '../component/layout/navigation-lock-context'
import { NotificationContext } from '../component/ui/notification-context'
import { ViewScreenPage } from './view-screen-page'

// The stream and control hooks are replaced, so no socket is ever opened. Each test sets what they return.
const hooks = vi.hoisted(() => ({
  stream: null as ScreenStream | null,
  control: null as RemoteControl | null,
}))

function idleStream(): ScreenStream {
  return {
    canvasRef: createRef<HTMLCanvasElement>(),
    status: { kind: 'idle' },
    hasFrame: false,
    reconnect: vi.fn(),
    sendMessage: vi.fn(() => true),
    subscribe: vi.fn(() => () => undefined),
  }
}

function controlOff(): RemoteControl {
  return {
    state: { kind: 'off', reason: null },
    isCoolingDown: false,
    start: vi.fn(),
    stop: vi.fn(),
    sendSecureAttention: vi.fn(),
    pasteProgressPercent: null,
    pasteOutcome: null,
    pasteText: vi.fn(() => ({ success: true as const })),
    stopPaste: vi.fn(),
  }
}

vi.mock('../component/pc/use-screen-stream', () => ({
  useScreenStream: () => hooks.stream ?? idleStream(),
}))

vi.mock('../component/pc/use-remote-control', () => ({
  useRemoteControl: () => hooks.control ?? controlOff(),
}))

function serverPc(id: number, name: string, isOnline = false) {
  return {
    id,
    name,
    // Offline by default, so the page opens no screen stream.
    isOnline,
    isLocked: false,
    ipAddress: null,
    registeredAt: '2026-11-01T08:00:00.000Z',
    lastSeenAt: '2026-11-10T10:00:00.000Z',
    session: null,
    shutdownState: isOnline ? null : 'shutdown',
    isServerPc: false,
  }
}

function stubPcs(pcs: ReturnType<typeof serverPc>[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(pcs))),
  )
}

// The page blocks navigation during remote control, which needs a data router, so it is built here.
function renderPage(path: string) {
  const router = createMemoryRouter([{ path: '/pc/:pcId/screen', element: <ViewScreenPage /> }], {
    initialEntries: [path],
  })
  render(
    <AuthContext.Provider
      value={{
        state: { status: 'signed-in', username: 'admin' },
        markSignedIn: vi.fn(),
        markSignedOut: vi.fn(),
        retry: vi.fn(),
      }}
    >
      <NavigationLockContext.Provider
        value={{ isNavigationLocked: false, setIsNavigationLocked: vi.fn() }}
      >
        <NotificationContext.Provider value={vi.fn()}>
          <RouterProvider router={router} />
        </NotificationContext.Provider>
      </NavigationLockContext.Provider>
    </AuthContext.Provider>,
  )
}

describe('ViewScreenPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    hooks.stream = null
    hooks.control = null
  })

  it('finds the PC by id and shows its current name', async () => {
    // PC 3 was renamed to PC-9, and PC 5 now has its old name.
    stubPcs([serverPc(5, 'PC-03'), serverPc(3, 'PC-9')])
    renderPage('/pc/3/screen?mode=notified')

    expect(await screen.findByRole('heading', { name: 'PC-9 screen' })).toBeTruthy()
  })

  it('shows not found when no PC has the id', async () => {
    stubPcs([serverPc(5, 'PC-05')])
    renderPage('/pc/3/screen')

    expect(await screen.findByRole('heading', { name: 'PC not found' })).toBeTruthy()
    expect(screen.getByText('This PC is no longer registered.')).toBeTruthy()
  })

  it('shows not found for a route that is not a PC id', async () => {
    stubPcs([serverPc(5, 'PC-05')])
    renderPage('/pc/PC-05/screen')

    expect(await screen.findByRole('heading', { name: 'PC not found' })).toBeTruthy()
  })

  it('shows the picture, the reported protected-screen badge and a working Ctrl+Alt+Del while controlling a secure screen', async () => {
    stubPcs([serverPc(3, 'PC-03', true)])
    hooks.stream = { ...idleStream(), status: { kind: 'secure' }, hasFrame: true }
    const control = { ...controlOff(), state: { kind: 'on' } as const }
    hooks.control = control
    renderPage('/pc/3/screen?mode=notified')

    fireEvent.click(await screen.findByRole('button', { name: 'Send Ctrl+Alt+Del' }))

    expect(control.sendSecureAttention).toHaveBeenCalledTimes(1)
    expect(screen.getByText('PC reports a protected screen')).toBeTruthy()
    expect(screen.getByRole('application').hidden).toBe(false)
    expect(screen.queryByText(/protected screen that can't be shown/)).toBeNull()
  })

  it('hides Ctrl+Alt+Del while control is off', async () => {
    stubPcs([serverPc(3, 'PC-03', true)])
    hooks.stream = { ...idleStream(), status: { kind: 'live' }, hasFrame: true }
    renderPage('/pc/3/screen?mode=notified')

    expect(await screen.findByRole('heading', { name: 'PC-03 screen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send Ctrl+Alt+Del' })).toBeNull()
  })
})

describe('ViewScreenPage paste text', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    hooks.stream = null
    hooks.control = null
  })

  it('shows Paste text and the typing progress while controlling', async () => {
    stubPcs([serverPc(3, 'PC-03', true)])
    hooks.stream = { ...idleStream(), status: { kind: 'live' }, hasFrame: true }
    const control = { ...controlOff(), state: { kind: 'on' } as const, pasteProgressPercent: 55 }
    hooks.control = control
    renderPage('/pc/3/screen?mode=notified')

    expect(await screen.findByRole('button', { name: 'Paste text' })).toBeTruthy()
    expect(screen.getByText('Typing… 55%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop typing' }))
    expect(control.stopPaste).toHaveBeenCalledTimes(1)
  })

  it('hides Paste text while control is off', async () => {
    stubPcs([serverPc(3, 'PC-03', true)])
    hooks.stream = { ...idleStream(), status: { kind: 'live' }, hasFrame: true }
    renderPage('/pc/3/screen?mode=notified')

    expect(await screen.findByRole('heading', { name: 'PC-03 screen' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Paste text' })).toBeNull()
  })
})
