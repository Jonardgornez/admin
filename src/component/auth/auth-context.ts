import { createContext, useContext } from 'react'
import type { AuthState } from '../../lib/auth-state'

interface AuthContextValue {
  state: AuthState
  markSignedIn: (username: string) => void
  markSignedOut: (notice?: string) => void
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return auth
}
