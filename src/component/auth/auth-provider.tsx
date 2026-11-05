import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { getCurrentAdmin } from '../../lib/auth-api'
import { authStateFromResult, reconcileAuthState, type AuthState } from '../../lib/auth-state'
import { AuthContext } from './auth-context'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const { pathname } = useLocation()
  const latestCheckId = useRef(0)

  const checkSession = useCallback(async () => {
    const checkId = ++latestCheckId.current
    const result = await getCurrentAdmin()
    // A newer check or a sign-in/out happened meanwhile, so this answer is stale.
    if (checkId !== latestCheckId.current) return
    setState((previous) => reconcileAuthState(previous, authStateFromResult(result)))
  }, [])

  // Recheck on route changes and window focus only. Never poll: each call
  // renews the sliding session, so a timer would stop the idle timeout firing.
  useEffect(() => {
    void checkSession()
  }, [pathname, checkSession])

  useEffect(() => {
    const recheck = () => void checkSession()
    window.addEventListener('focus', recheck)
    return () => window.removeEventListener('focus', recheck)
  }, [checkSession])

  const markSignedIn = useCallback((username: string) => {
    latestCheckId.current++
    setState({ status: 'signed-in', username })
  }, [])

  const markSignedOut = useCallback((notice?: string) => {
    latestCheckId.current++
    setState({ status: 'signed-out', notice })
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    void checkSession()
  }, [checkSession])

  const value = useMemo(
    () => ({ state, markSignedIn, markSignedOut, retry }),
    [state, markSignedIn, markSignedOut, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
