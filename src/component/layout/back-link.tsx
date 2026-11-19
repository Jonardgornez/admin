import { Link } from 'react-router'
import { useNavigationLock } from './navigation-lock-context'

interface BackLinkProps {
  to: string
  label: string
}

export function BackLink({ to, label }: BackLinkProps) {
  const { isNavigationLocked } = useNavigationLock()

  return (
    <Link
      to={to}
      inert={isNavigationLocked}
      className="self-start rounded-sm font-semibold text-brand inert:opacity-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {label}
    </Link>
  )
}

export function BackToDashboardLink() {
  return <BackLink to="/dashboard" label="Back to dashboard" />
}
