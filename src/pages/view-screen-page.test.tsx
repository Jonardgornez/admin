// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../component/auth/auth-context'
import { NavigationLockContext } from '../component/layout/navigation-lock-context'
import { NotificationContext } from '../component/ui/notification-context'
import { ViewScreenPage } from './view-screen-page'

function serverPc(id: number, name: string) {
  return {
    id,
    name,
    // Offline, so the page opens no screen stream.
    isOnline: false,
    isLocked: false,
    ipAddress: null,
    registeredAt: '2026-11-01T08:00:00.000Z',
    lastSeenAt: '2026-11-10T10:00:00.000Z',
    session: null,
    shutdownState: 'shutdown',
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
})
