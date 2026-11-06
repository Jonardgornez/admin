import { useFormContext } from 'react-hook-form'
import {
  MAX_IDLE_TIMEOUT_MINUTES,
  MIN_IDLE_TIMEOUT_MINUTES,
  type SettingsFormValues,
} from '../../lib/settings-schemas'
import { RadioOption } from '../ui/choice'
import { Field, TextInput } from '../ui/field'
import { SettingsCard } from './settings-card'
import { SettingsFieldset } from './settings-fieldset'

const APPLIES_NEXT_SIGN_IN_NOTE = 'Applies from your next sign-in.'

export function ConsoleSessionCard() {
  const { register, formState: { errors } } = useFormContext<SettingsFormValues>()
  const idleError = errors.idleTimeoutMinutes?.message

  return (
    <SettingsCard title="Console session">
      <Field
        label="Sign out after inactivity (minutes)"
        htmlFor="settings-idle-timeout"
        className="max-w-60"
        message={idleError ?? APPLIES_NEXT_SIGN_IN_NOTE}
        isError={idleError !== undefined}
      >
        <TextInput
          id="settings-idle-timeout"
          type="number"
          min={MIN_IDLE_TIMEOUT_MINUTES}
          max={MAX_IDLE_TIMEOUT_MINUTES}
          step={1}
          hasError={idleError !== undefined}
          aria-describedby="settings-idle-timeout-message"
          {...register('idleTimeoutMinutes')}
        />
      </Field>
      <SettingsFieldset legend="Default screen view mode">
        <RadioOption value="notified" {...register('defaultViewMode')}>
          Notified
        </RadioOption>
        <RadioOption value="anonymous" {...register('defaultViewMode')}>
          Anonymous
        </RadioOption>
      </SettingsFieldset>
    </SettingsCard>
  )
}
