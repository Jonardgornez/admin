import { Link } from 'react-router'
import { useNavigationLock } from './navigation-lock-context'

export function BackToDashboardLink() {
  const { isNavigationLocked } = useNavigationLock()

  return (
    <Link
      to="/dashboard"
      inert={isNavigationLocked}
      className="self-start rounded-sm font-semibold text-brand inert:opacity-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      Back to dashboard
    </Link>
  )
}
