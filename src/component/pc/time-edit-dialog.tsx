import { useState, type ReactNode } from 'react'
import { getTimeAmountError, parseTimeAmount } from '../../lib/pcs'
import type { ApprovalChoice, TimeUnit } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { TimeChoiceFields } from '../ui/time-choice-fields'

type TimeMode = ApprovalChoice['mode']

const DEFAULT_AMOUNT = '30'

interface TimeEditDialogProps {
  title: string
  // Facts about the PCs, shown above the time choices.
  notes?: ReactNode
  timeLimitLabel: string
  canTimeOut: boolean
  timeOutLabel: string
  // Shown once Time out is chosen, to say what happens to the session.
  timeOutNote: string
  isBusy: boolean
  onConfirm: (choice: ApprovalChoice) => void
  onTimeOut: () => void
  onCancel: () => void
}

// The body shared by the single-PC and bulk Edit time dialogs. Each one supplies its own text.
export function TimeEditDialog({
  title,
  notes,
  timeLimitLabel,
  canTimeOut,
  timeOutLabel,
  timeOutNote,
  isBusy,
  onConfirm,
  onTimeOut,
  onCancel,
}: TimeEditDialogProps) {
  const [timeMode, setTimeMode] = useState<TimeMode | null>('time-limit')
  const [amount, setAmount] = useState(DEFAULT_AMOUNT)
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('minutes')
  const isTimingOut = timeMode === null
  const isAddingTime = timeMode === 'time-limit'
  const minutes = parseTimeAmount(amount, timeUnit)
  const amountError = isAddingTime ? getTimeAmountError(amount, timeUnit) : undefined

  function confirm() {
    if (isTimingOut) onTimeOut()
    else if (!isAddingTime) onConfirm({ mode: 'open-time' })
    else if (minutes !== null && amountError === undefined) {
      onConfirm({ mode: 'time-limit', minutes })
    }
  }

  return (
    <ConfirmDialog
      isOpen
      title={title}
      confirmLabel={isTimingOut ? 'Time out' : 'Confirm'}
      confirmVariant={isTimingOut ? 'danger' : 'primary'}
      isConfirmDisabled={amountError !== undefined || isBusy}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-4">
        {notes}
        <TimeChoiceFields
          legend="Session time"
          isLegendHidden
          timeLimitLabel={timeLimitLabel}
          timeMode={timeMode}
          extraOption={
            canTimeOut
              ? {
                  label: timeOutLabel,
                  isSelected: isTimingOut,
                  onSelect: () => setTimeMode(null),
                }
              : undefined
          }
          amount={amount}
          timeUnit={timeUnit}
          amountError={amountError}
          onTimeModeChange={setTimeMode}
          onAmountChange={setAmount}
          onTimeUnitChange={setTimeUnit}
        />
        {isTimingOut && (
          <p className="m-0" role="status">
            {timeOutNote}
          </p>
        )}
      </div>
    </ConfirmDialog>
  )
}
