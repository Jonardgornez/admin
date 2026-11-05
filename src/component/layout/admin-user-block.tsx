import { useState } from 'react'
import { signOut } from '../../lib/auth-api'
import { useAuth } from '../auth/auth-context'
import { useNotify } from '../ui/notification-context'
import { useNavigationLock } from './navigation-lock-context'

const UNAUTHORIZED_STATUS = 401

export function AdminUserBlock() {
  const { isNavigationLocked } = useNavigationLock()
  const { state, markSignedOut } = useAuth()
  const notify = useNotify()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function logOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    const result = await signOut()
    if (result.success || result.status === UNAUTHORIZED_STATUS) {
      // RequireAuth sends the admin back to the sign-in page.
      markSignedOut()
      return
    }
    setIsSigningOut(false)
    notify(result.error, 'alert')
  }

  return (
    <>
      <span className="text-ink-muted">
        {state.status === 'signed-in' ? state.username : ''}
      </span>
      <button
        type="button"
        onClick={logOut}
        disabled={isSigningOut}
        inert={isNavigationLocked}
        className="rounded-sm px-2 font-semibold text-brand inert:opacity-disabled disabled:opacity-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {isSigningOut ? 'Logging out...' : 'Log out'}
      </button>
    </>
  )
}
