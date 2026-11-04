import { useId } from 'react'
import { cva } from 'class-variance-authority'
import type { ApprovalChoice, TimeUnit } from '../../types'
import { RadioOption } from './choice'
import { Field, TextInput } from './field'

type TimeMode = ApprovalChoice['mode']

const legendVariants = cva('', {
  variants: {
    isHidden: {
      true: 'sr-only',
      false: 'p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted',
    },
  },
})

interface TimeChoiceFieldsProps {
  legend: string
  isLegendHidden?: boolean
  timeLimitLabel: string
  timeMode: TimeMode
  amount: string
  timeUnit: TimeUnit
  amountError?: string
  onTimeModeChange: (timeMode: TimeMode) => void
  onAmountChange: (amount: string) => void
  onTimeUnitChange: (timeUnit: TimeUnit) => void
}

export function TimeChoiceFields({
  legend,
  isLegendHidden = false,
  timeLimitLabel,
  timeMode,
  amount,
  timeUnit,
  amountError,
  onTimeModeChange,
  onAmountChange,
  onTimeUnitChange,
}: TimeChoiceFieldsProps) {
  const baseId = useId()
  const amountId = `${baseId}-amount`
  const modeName = `${baseId}-mode`
  const unitName = `${baseId}-unit`
  const hasTimeLimit = timeMode === 'time-limit'
  const hasAmountError = amountError !== undefined

  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className={legendVariants({ isHidden: isLegendHidden })}>{legend}</legend>
      <RadioOption
        name={modeName}
        value="time-limit"
        checked={hasTimeLimit}
        onChange={() => onTimeModeChange('time-limit')}
      >
        {timeLimitLabel}
      </RadioOption>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 pl-6">
        <Field label="Amount" htmlFor={amountId} message={amountError} isError className="w-40">
          <TextInput
            id={amountId}
            type="number"
            min={1}
            step={1}
            value={amount}
            disabled={!hasTimeLimit}
            hasError={hasAmountError}
            aria-describedby={hasAmountError ? `${amountId}-message` : undefined}
            onChange={(event) => onAmountChange(event.target.value)}
          />
        </Field>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="p-0 pb-1.5 text-xs font-semibold tracking-label text-ink-muted">
            Unit
          </legend>
          <div className="flex min-h-control-md items-center gap-4">
            <RadioOption
              name={unitName}
              value="minutes"
              checked={timeUnit === 'minutes'}
              disabled={!hasTimeLimit}
              onChange={() => onTimeUnitChange('minutes')}
            >
              Minutes
            </RadioOption>
            <RadioOption
              name={unitName}
              value="hours"
              checked={timeUnit === 'hours'}
              disabled={!hasTimeLimit}
              onChange={() => onTimeUnitChange('hours')}
            >
              Hours
            </RadioOption>
          </div>
        </fieldset>
      </div>
      <RadioOption
        name={modeName}
        value="open-time"
        checked={!hasTimeLimit}
        onChange={() => onTimeModeChange('open-time')}
      >
        Open time – no time limit
      </RadioOption>
    </fieldset>
  )
}
