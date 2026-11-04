import { ButtonLink } from '../component/ui/button'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-6 text-center">
      <h1 className="m-0 text-2xl font-semibold">Page not found</h1>
      <p className="m-0 text-ink-muted">This page does not exist.</p>
      <ButtonLink to="/dashboard" variant="primary">
        Go to dashboard
      </ButtonLink>
    </main>
  )
}
