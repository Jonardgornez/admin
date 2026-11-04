import { Link } from 'react-router'

export function BackToDashboardLink() {
  return (
    <Link
      to="/dashboard"
      className="self-start rounded-sm font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      Back to dashboard
    </Link>
  )
}
