import { useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import lykantraMark from '../assets/lykantra-mark.svg'
import { useAuth } from '../component/auth/auth-context'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Field, TextInput } from '../component/ui/field'
import { Icon } from '../component/ui/icon'
import { signIn } from '../lib/auth-api'
import { signInSchema, type SignInValues } from '../lib/auth-schemas'
import { readNotice } from '../lib/auth-state'

export function SignInPage() {
  const { state, markSignedIn } = useAuth()
  const notice = readNotice(useLocation().state)
  const isSubmittingRef = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { username: '', password: '' },
  })

  async function onSubmit(values: SignInValues) {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    try {
      const result = await signIn(values.username, values.password)
      if (result.success) {
        markSignedIn(result.data.username)
      } else {
        setError('root', { message: result.error })
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  if (state.status === 'signed-in') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-100 px-4 py-6">
      <form
        onSubmit={(event) => handleSubmit(onSubmit)(event)}
        noValidate
        className="flex w-full max-w-100 flex-col gap-4 rounded-lg border border-border bg-surface-200 p-6 shadow-card"
      >
        <div className="flex flex-col gap-1">
          <img src={lykantraMark} alt="" width={96} height={96} className="size-24 self-center" />
          <span className="text-center text-sm font-semibold text-brand">Lykantra Admin Console</span>
          <h1 className="m-0 text-2xl font-semibold">Sign in</h1>
        </div>
        {notice && (
          <Banner variant="info" icon="info" role="status">
            {notice}
          </Banner>
        )}
        {errors.root && (
          <Banner variant="danger" icon="alert" role="alert">
            {errors.root.message}
          </Banner>
        )}
        <Field
          label="Username"
          htmlFor="sign-in-username"
          message={errors.username?.message}
          isError={Boolean(errors.username)}
        >
          <TextInput
            id="sign-in-username"
            autoComplete="username"
            hasError={Boolean(errors.username)}
            aria-describedby={errors.username ? 'sign-in-username-message' : undefined}
            {...register('username')}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="sign-in-password"
          message={errors.password?.message}
          isError={Boolean(errors.password)}
        >
          <TextInput
            id="sign-in-password"
            type="password"
            autoComplete="current-password"
            hasError={Boolean(errors.password)}
            aria-describedby={errors.password ? 'sign-in-password-message' : undefined}
            {...register('password')}
          />
        </Field>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </Button>
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
