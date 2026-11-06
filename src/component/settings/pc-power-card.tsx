import { useFormContext } from 'react-hook-form'
import {
  MAX_POWER_COUNTDOWN_SECONDS,
  MIN_POWER_COUNTDOWN_SECONDS,
  type SettingsFormValues,
} from '../../lib/settings-schemas'
import { Field, TextInput } from '../ui/field'
import { SettingsCard } from './settings-card'

const APPLIES_NEXT_POWER_COMMAND_NOTE = 'Applies to the next Shut down or Reboot.'

export function PcPowerCard() {
  const { register, formState: { errors } } = useFormContext<SettingsFormValues>()
  const countdownError = errors.powerCountdownSeconds?.message

  return (
    <SettingsCard title="PC power">
      <Field
        label="Shutdown and reboot countdown (seconds)"
        htmlFor="settings-power-countdown"
        className="max-w-60"
        message={countdownError ?? APPLIES_NEXT_POWER_COMMAND_NOTE}
        isError={countdownError !== undefined}
      >
        <TextInput
          id="settings-power-countdown"
          type="number"
          min={MIN_POWER_COUNTDOWN_SECONDS}
          max={MAX_POWER_COUNTDOWN_SECONDS}
          step={1}
          hasError={countdownError !== undefined}
          aria-describedby="settings-power-countdown-message"
          {...register('powerCountdownSeconds')}
        />
      </Field>
    </SettingsCard>
  )
}
