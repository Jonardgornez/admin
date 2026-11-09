import { useMemo, useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AuthContext } from '../component/auth/auth-context'
import { NavigationLockContext } from '../component/layout/navigation-lock-context'
import { NotificationContext, type Notify } from '../component/ui/notification-context'
import type { AuthState } from '../lib/auth-state'

const SIGNED_IN: AuthState = { status: 'signed-in', username: 'admin' }
const DEFAULT_NOTIFY: Notify = vi.fn()

interface TestProvidersProps {
  children: ReactNode
  state?: AuthState
  initialPath?: string
  notify?: Notify
}

// The providers the admin console gives its pages, minus the real session check and the toast popover.
// Auth state is set directly so each test chooses whether the admin is signed in.
export function TestProviders({
  children,
  state = SIGNED_IN,
  initialPath = '/',
  notify = DEFAULT_NOTIFY,
}: TestProvidersProps) {
  const [authActions] = useState(() => ({
    markSignedIn: vi.fn(),
    markSignedOut: vi.fn(),
    retry: vi.fn(),
  }))
  const auth = useMemo(() => ({ state, ...authActions }), [state, authActions])
  const [navigationLock] = useState(() => ({
    isNavigationLocked: false,
    setIsNavigationLocked: vi.fn(),
  }))

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={auth}>
        <NavigationLockContext.Provider value={navigationLock}>
          <NotificationContext.Provider value={notify}>{children}</NotificationContext.Provider>
        </NavigationLockContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}
