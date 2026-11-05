import type { SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import lykantraMark from '../assets/lykantra-mark.svg'
import { Button } from '../component/ui/button'
import { Field, TextInput } from '../component/ui/field'
import { Icon } from '../component/ui/icon'

export function SignInPage() {
  const navigate = useNavigate()

  function signIn(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-100 px-4 py-6">
      <form
        onSubmit={signIn}
        className="flex w-full max-w-100 flex-col gap-4 rounded-lg border border-border bg-surface-200 p-6 shadow-card"
      >
        <div className="flex flex-col gap-1">
          <img src={lykantraMark} alt="" width={96} height={96} className="size-24 self-center" />
          <span className="text-sm font-semibold text-brand">Lykantra Admin Console</span>
          <h1 className="m-0 text-2xl font-semibold">Sign in</h1>
        </div>
        <Field label="Username" htmlFor="sign-in-username">
          <TextInput id="sign-in-username" name="username" autoComplete="username" />
        </Field>
        <Field label="Password" htmlFor="sign-in-password">
          <TextInput
            id="sign-in-password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
        </Field>
        <Button type="submit">Log in</Button>
        <p className="m-0 text-sm text-ink-muted">
          Forgot the password? Reset it from the server program on this PC.
        </p>
      </form>
      <p className="m-0 flex items-center gap-2 text-xs text-ink-subtle">
        <Icon name="monitor" />
        <span>
          Opens only on the server PC at <span className="font-mono">localhost:[PORT]</span>
        </span>
      </p>
      <p className="m-0 text-xs text-ink-subtle">© 2026 Jonard M. Gornez</p>
    </main>
  )
}
