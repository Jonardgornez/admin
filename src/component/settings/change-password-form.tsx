import { useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { changePassword } from '../../lib/auth-api'
import { changePasswordSchema, type ChangePasswordValues } from '../../lib/auth-schemas'
import { PASSWORD_CHANGED_NOTICE } from '../../lib/auth-state'
import { useAuth } from '../auth/auth-context'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field, TextInput } from '../ui/field'

export function ChangePasswordForm() {
  const { markSignedOut } = useAuth()
  const isSubmittingRef = useRef(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function onSubmit(values: ChangePasswordValues) {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    try {
      const result = await changePassword(values.currentPassword, values.newPassword)
      if (result.success) {
        // All sessions ended on the server; RequireAuth redirects to sign-in.
        markSignedOut(PASSWORD_CHANGED_NOTICE)
      } else if (result.status === 401) {
        markSignedOut()
      } else {
        setError('root', { message: result.error })
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  return (
    <form onSubmit={(event) => handleSubmit(onSubmit)(event)} noValidate className="flex flex-col gap-4">
      {errors.root && (
        <Banner variant="danger" icon="alert" role="alert">
          {errors.root.message}
        </Banner>
      )}
      <Field
        label="Current password"
        htmlFor="settings-current-password"
        message={errors.currentPassword?.message}
        isError={Boolean(errors.currentPassword)}
      >
        <TextInput
          id="settings-current-password"
          type="password"
          autoComplete="current-password"
          hasError={Boolean(errors.currentPassword)}
          aria-describedby={errors.currentPassword ? 'settings-current-password-message' : undefined}
          {...register('currentPassword')}
        />
      </Field>
      <Field
        label="New password"
        htmlFor="settings-new-password"
        message={errors.newPassword?.message}
        isError={Boolean(errors.newPassword)}
      >
        <TextInput
          id="settings-new-password"
          type="password"
          autoComplete="new-password"
          hasError={Boolean(errors.newPassword)}
          aria-describedby={errors.newPassword ? 'settings-new-password-message' : undefined}
          {...register('newPassword')}
        />
      </Field>
      <Field
        label="Confirm new password"
        htmlFor="settings-confirm-password"
        message={errors.confirmPassword?.message}
        isError={Boolean(errors.confirmPassword)}
      >
        <TextInput
          id="settings-confirm-password"
          type="password"
          autoComplete="new-password"
          hasError={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? 'settings-confirm-password-message' : undefined}
          {...register('confirmPassword')}
        />
      </Field>
      <p className="m-0 text-xs text-ink-muted">
        Changing the password signs out every open console session.
      </p>
      <div>
        <Button variant="secondary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Changing...' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
