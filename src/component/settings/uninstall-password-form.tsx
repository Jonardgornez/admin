import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import type { UninstallPasswordStatus } from '../../lib/uninstall-password-api'
import {
  uninstallPasswordSchema,
  type UninstallPasswordValues,
} from '../../lib/uninstall-password-schema'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field, TextInput } from '../ui/field'
import { useNotify } from '../ui/notification-context'

interface UninstallPasswordFormProps {
  isDisabled: boolean
  onSave: (password: string) => Promise<ApiResult<UninstallPasswordStatus> | null>
}

const EMPTY_VALUES: UninstallPasswordValues = { password: '', confirmPassword: '' }

export function UninstallPasswordForm({ isDisabled, onSave }: UninstallPasswordFormProps) {
  const notify = useNotify()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UninstallPasswordValues>({
    resolver: zodResolver(uninstallPasswordSchema),
    defaultValues: EMPTY_VALUES,
  })

  async function onSubmit(values: UninstallPasswordValues) {
    const result = await onSave(values.password)
    if (!result) return
    if (result.success) {
      reset(EMPTY_VALUES)
      notify('Uninstall password saved.')
    } else if (!isSessionExpired(result)) {
      setError('root', { message: result.error })
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
        label="New password"
        htmlFor="settings-uninstall-password"
        message={errors.password?.message}
        isError={Boolean(errors.password)}
      >
        <TextInput
          id="settings-uninstall-password"
          type="password"
          autoComplete="new-password"
          hasError={Boolean(errors.password)}
          aria-describedby={errors.password ? 'settings-uninstall-password-message' : undefined}
          {...register('password')}
        />
      </Field>
      <Field
        label="Confirm password"
        htmlFor="settings-uninstall-confirm-password"
        message={errors.confirmPassword?.message}
        isError={Boolean(errors.confirmPassword)}
      >
        <TextInput
          id="settings-uninstall-confirm-password"
          type="password"
          autoComplete="new-password"
          hasError={Boolean(errors.confirmPassword)}
          aria-describedby={
            errors.confirmPassword ? 'settings-uninstall-confirm-password-message' : undefined
          }
          {...register('confirmPassword')}
        />
      </Field>
      <div>
        <Button variant="secondary" type="submit" disabled={isSubmitting || isDisabled}>
          {isSubmitting ? 'Saving...' : 'Save password'}
        </Button>
      </div>
    </form>
  )
}
