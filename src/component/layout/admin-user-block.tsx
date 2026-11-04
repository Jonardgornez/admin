import { Link } from 'react-router'
import { useNavigationLock } from './navigation-lock-context'

export function AdminUserBlock() {
  const { isNavigationLocked } = useNavigationLock()

  return (
    <>
      <span className="text-ink-muted">admin</span>
      <Link
        to="/"
        inert={isNavigationLocked}
        className="rounded-sm px-2 font-semibold text-brand inert:opacity-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Log out
      </Link>
    </>
  )
}
