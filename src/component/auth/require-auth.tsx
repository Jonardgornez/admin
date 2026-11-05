import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { useAuth } from './auth-context'

interface RequireAuthProps {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { state, retry } = useAuth()

  switch (state.status) {
    case 'loading':
      return (
        <main className="flex min-h-screen items-center justify-center bg-surface-100 px-4">
          <p role="status" className="m-0 text-base text-ink-muted">
            Checking your session...
          </p>
        </main>
      )
    case 'unreachable':
      return (
        <main className="flex min-h-screen items-center justify-center bg-surface-100 px-4 py-6">
          <div className="flex w-full max-w-100 flex-col gap-4">
            <Banner variant="danger" icon="alert" title="Can't load the console" role="alert">
              The server isn't responding. Check that it's running, then try again.
            </Banner>
            <Button onClick={retry}>Retry</Button>
          </div>
        </main>
      )
    case 'signed-out':
      return <Navigate to="/" replace state={{ notice: state.notice }} />
    case 'signed-in':
      return children
  }
}
