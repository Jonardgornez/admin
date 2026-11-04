import { createContext, useContext } from 'react'

interface NavigationLock {
  isNavigationLocked: boolean
  setIsNavigationLocked: (isLocked: boolean) => void
}

export const NavigationLockContext = createContext<NavigationLock | null>(null)

export function useNavigationLock(): NavigationLock {
  const navigationLock = useContext(NavigationLockContext)
  if (!navigationLock) {
    throw new Error('useNavigationLock must be used inside AppShell')
  }
  return navigationLock
}
