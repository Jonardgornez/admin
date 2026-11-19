import { useFormContext, useWatch } from 'react-hook-form'
import {
  MAX_IDLE_TIMEOUT_MINUTES,
  MIN_IDLE_TIMEOUT_MINUTES,
  type SettingsFormValues,
} from '../../lib/settings-schemas'
import { Checkbox, RadioOption } from '../ui/choice'
import { Field, TextInput } from '../ui/field'
import { SettingsCard } from './settings-card'
import { SettingsFieldset } from './settings-fieldset'

const APPLIES_NEXT_SIGN_IN_NOTE = 'Applies from your next sign-in.'
const MINUTES_NOTE =
  'Applies from your next sign-in. Turning off "Stay signed in" also signs out your other browsers.'
const STAY_SIGNED_IN_NOTE =
  "You'll stay signed in on this computer, even after closing the browser, until you sign out."

export function ConsoleSessionCard() {
  const { register, control, formState: { errors } } = useFormContext<SettingsFormValues>()
  const staySignedIn = useWatch({ control, name: 'staySignedIn' })
  const idleError = errors.idleTimeoutMinutes?.message

  return (
    <SettingsCard title="Console session">
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 font-semibold">
          <Checkbox aria-describedby="settings-stay-signed-in-note" {...register('staySignedIn')} />
          Stay signed in until I sign out
        </label>
        <p id="settings-stay-signed-in-note" className="m-0 text-xs text-ink-muted">
          {STAY_SIGNED_IN_NOTE}
        </p>
        {staySignedIn && (
          <p className="m-0 text-xs text-ink-muted">{APPLIES_NEXT_SIGN_IN_NOTE}</p>
        )}
      </div>
      {!staySignedIn && (
        <Field
          label="Sign out after inactivity (minutes)"
          htmlFor="settings-idle-timeout"
          className="max-w-60"
          message={idleError ?? MINUTES_NOTE}
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
      )}
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
