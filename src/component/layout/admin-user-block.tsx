import { Link } from 'react-router'

export function AdminUserBlock() {
  return (
    <>
      <span className="text-ink-muted">admin</span>
      <Link
        to="/"
        className="rounded-sm px-2 font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Log out
      </Link>
    </>
  )
}
