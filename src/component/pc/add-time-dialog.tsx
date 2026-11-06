import { useState } from 'react'
import { canTimeOutPc, getTimeAmountError, getTimeLeftLabel, parseTimeAmount } from '../../lib/pcs'
import type { ApprovalChoice, Pc, TimeUnit } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { TimeChoiceFields } from '../ui/time-choice-fields'

interface AddTimeDialogProps {
  pc: Pc
  isBusy: boolean
  onConfirm: (choice: ApprovalChoice) => void
  onTimeOut: () => void
  onCancel: () => void
}

type TimeMode = ApprovalChoice['mode']

const DEFAULT_AMOUNT = '30'

export function AddTimeDialog({ pc, isBusy, onConfirm, onTimeOut, onCancel }: AddTimeDialogProps) {
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
      title={`Edit time for ${pc.name}`}
      confirmLabel={isTimingOut ? 'Time out' : 'Confirm'}
      confirmVariant={isTimingOut ? 'danger' : 'primary'}
      isConfirmDisabled={amountError !== undefined || isBusy}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0">{`Time left: ${getTimeLeftLabel(pc) ?? 'No limit set'}`}</p>
        {pc.status === 'frozen' && (
          <p className="m-0">The time stays paused until you unlock this PC.</p>
        )}
        <TimeChoiceFields
          legend="Session time"
          isLegendHidden
          timeLimitLabel={pc.isOpenTime ? 'Set time limit' : 'Add time'}
          timeMode={timeMode}
          extraOption={
            canTimeOutPc(pc)
              ? {
                  label: 'Time out – no time left',
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
            {pc.user ? `${pc.user}'s session` : 'This session'} ends now and {pc.name} returns to
            the login screen. Unsaved work may be lost.
          </p>
        )}
      </div>
    </ConfirmDialog>
  )
}
