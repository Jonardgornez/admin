import { useFormContext, useWatch } from 'react-hook-form'
import type { SettingsFormValues } from '../../lib/settings-schemas'
import { Field, TextInput } from '../ui/field'
import { RadioOption } from '../ui/choice'
import { SettingsCard } from './settings-card'
import { SettingsFieldset } from './settings-fieldset'

export function LoginRequestsCard() {
  const { register, control, formState: { errors } } = useFormContext<SettingsFormValues>()
  const approvalMode = useWatch({ control, name: 'approvalMode' })
  const isTimeLimit = approvalMode === 'time-limit'
  const minutesError = errors.defaultMinutes?.message

  return (
    <SettingsCard title="Login requests">
      <SettingsFieldset legend="Default approval">
        <RadioOption value="time-limit" {...register('approvalMode')}>
          Time limit
        </RadioOption>
        <RadioOption value="open-time" {...register('approvalMode')}>
          Open time (no limit)
        </RadioOption>
      </SettingsFieldset>
      <Field
        label="Default time limit (minutes)"
        htmlFor="settings-time-limit"
        className="max-w-60"
        message={minutesError}
        isError={minutesError !== undefined}
      >
        <TextInput
          id="settings-time-limit"
          type="number"
          min={1}
          step={1}
          disabled={!isTimeLimit}
          hasError={minutesError !== undefined}
          aria-describedby={minutesError ? 'settings-time-limit-message' : undefined}
          {...register('defaultMinutes')}
        />
      </Field>
      <p className="m-0 text-xs text-ink-muted">You can change this for each approval.</p>
    </SettingsCard>
  )
}
