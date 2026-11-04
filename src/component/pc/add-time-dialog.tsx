import { useState } from 'react'
import { getTimeLeftLabel, parseTimeAmount } from '../../lib/pcs'
import type { ApprovalChoice, Pc, TimeUnit } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { TimeChoiceFields } from '../ui/time-choice-fields'

interface AddTimeDialogProps {
  pc: Pc
  onConfirm: (choice: ApprovalChoice) => void
  onCancel: () => void
}

type TimeMode = ApprovalChoice['mode']

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
        <TimeChoiceFields
          legend="Session time"
          isLegendHidden
          timeLimitLabel="Add time"
          timeMode={timeMode}
          amount={amount}
          timeUnit={timeUnit}
          amountError={hasAmountError ? 'Enter a whole number of 1 or more.' : undefined}
          onTimeModeChange={setTimeMode}
          onAmountChange={setAmount}
          onTimeUnitChange={setTimeUnit}
        />
      </div>
    </ConfirmDialog>
  )
}
