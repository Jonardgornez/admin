import { useMemo, useState } from 'react'
import { Outlet } from 'react-router'
import { NotificationProvider } from '../ui/notification-provider'
import { NavigationLockContext } from './navigation-lock-context'
import { Sidebar } from './sidebar'

export function AppShell() {
  const [isNavigationLocked, setIsNavigationLocked] = useState(false)
  const navigationLock = useMemo(
    () => ({ isNavigationLocked, setIsNavigationLocked }),
    [isNavigationLocked],
  )

  return (
    <NotificationProvider>
      <NavigationLockContext.Provider value={navigationLock}>
        <div className="flex min-h-screen flex-col bg-surface-100 md:flex-row">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:px-8 md:pt-6 md:pb-8">
            <Outlet />
          </main>
        </div>
      </NavigationLockContext.Provider>
    </NotificationProvider>
  )
}
