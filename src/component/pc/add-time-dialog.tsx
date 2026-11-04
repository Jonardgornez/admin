import { useState } from 'react'
import { getTimeLeftLabel, parseTimeAmount } from '../../lib/pcs'
import type { ApprovalChoice, Pc, TimeUnit } from '../../types'
import { RadioOption } from '../ui/choice'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Field, TextInput } from '../ui/field'

interface AddTimeDialogProps {
  pc: Pc
  onConfirm: (choice: ApprovalChoice) => void
  onCancel: () => void
}

type TimeMode = ApprovalChoice['mode']

const AMOUNT_INPUT_ID = 'add-time-amount'
const DEFAULT_AMOUNT = '30'

export function AddTimeDialog({ pc, onConfirm, onCancel }: AddTimeDialogProps) {
  const [timeMode, setTimeMode] = useState<TimeMode>('time-limit')
  const [amount, setAmount] = useState(DEFAULT_AMOUNT)
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('minutes')
  const isAddingTime = timeMode === 'time-limit'
  const minutes = parseTimeAmount(amount, timeUnit)
  const hasAmountError = isAddingTime && minutes === null

  function confirm() {
    if (!isAddingTime) onConfirm({ mode: 'open-time' })
    else if (minutes !== null) onConfirm({ mode: 'time-limit', minutes })
  }

  return (
    <ConfirmDialog
      isOpen
      title={`Add time to ${pc.name}`}
      confirmLabel="Confirm"
      confirmVariant="primary"
      isConfirmDisabled={hasAmountError}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0">
          {pc.status === 'locked'
            ? 'This PC is locked. Confirming unlocks it and starts a session.'
            : `Time left: ${getTimeLeftLabel(pc) ?? 'No limit set'}`}
        </p>
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="sr-only">Session time</legend>
          <RadioOption
            name="add-time-mode"
            value="time-limit"
            checked={isAddingTime}
            onChange={() => setTimeMode('time-limit')}
          >
            Add time
          </RadioOption>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3 pl-6">
            <Field
              label="Amount"
              htmlFor={AMOUNT_INPUT_ID}
              message={hasAmountError ? 'Enter a whole number of 1 or more.' : undefined}
              isError
              className="w-40"
            >
              <TextInput
                id={AMOUNT_INPUT_ID}
                type="number"
                min={1}
                step={1}
                value={amount}
                disabled={!isAddingTime}
                hasError={hasAmountError}
                aria-describedby={hasAmountError ? `${AMOUNT_INPUT_ID}-message` : undefined}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="p-0 pb-1.5 text-xs font-semibold tracking-label text-ink-muted">
                Unit
              </legend>
              <div className="flex min-h-control-md items-center gap-4">
                <RadioOption
                  name="add-time-unit"
                  value="minutes"
                  checked={timeUnit === 'minutes'}
                  disabled={!isAddingTime}
                  onChange={() => setTimeUnit('minutes')}
                >
                  Minutes
                </RadioOption>
                <RadioOption
                  name="add-time-unit"
                  value="hours"
                  checked={timeUnit === 'hours'}
                  disabled={!isAddingTime}
                  onChange={() => setTimeUnit('hours')}
                >
                  Hours
                </RadioOption>
              </div>
            </fieldset>
          </div>
          <RadioOption
            name="add-time-mode"
            value="open-time"
            checked={!isAddingTime}
            onChange={() => setTimeMode('open-time')}
          >
            Open time – no time limit
          </RadioOption>
        </fieldset>
      </div>
    </ConfirmDialog>
  )
}
