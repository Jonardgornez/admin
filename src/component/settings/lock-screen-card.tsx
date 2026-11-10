import { useFormContext, useWatch } from 'react-hook-form'
import { MAX_LOCK_MESSAGE_LENGTH } from '../../lib/lock-message-schema'
import type { SettingsFormValues } from '../../lib/settings-schemas'
import { Field, TextArea } from '../ui/field'
import { SettingsCard } from './settings-card'

export function LockScreenCard() {
  const { register, control, formState: { errors } } = useFormContext<SettingsFormValues>()
  const lockMessage = useWatch({ control, name: 'lockMessage' })
  const messageError = errors.lockMessage?.message
  const counterText = `${lockMessage.trim().length}/${MAX_LOCK_MESSAGE_LENGTH}`

  return (
    <SettingsCard title="Lock screen">
      <p className="m-0 text-sm text-ink-muted">
        Shown on a locked PC. When you lock a PC, you can type a different message for that lock.
      </p>
      <Field
        label="Lock screen message"
        htmlFor="settings-lock-message"
        message={messageError ?? counterText}
        isError={messageError !== undefined}
      >
        <TextArea
          id="settings-lock-message"
          rows={3}
          className="resize-y"
          hasError={messageError !== undefined}
          aria-describedby={messageError ? 'settings-lock-message-message' : undefined}
          {...register('lockMessage')}
        />
      </Field>
    </SettingsCard>
  )
}
