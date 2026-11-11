import { canTimeOutPc, getTimeLeftLabel } from '../../lib/pcs'
import type { ApprovalChoice, Pc } from '../../types'
import { TimeEditDialog } from './time-edit-dialog'

interface AddTimeDialogProps {
  pc: Pc
  isBusy: boolean
  onConfirm: (choice: ApprovalChoice) => void
  onTimeOut: () => void
  onCancel: () => void
}

export function AddTimeDialog({ pc, isBusy, onConfirm, onTimeOut, onCancel }: AddTimeDialogProps) {
  const sessionOwner = pc.user ? `${pc.user}'s session` : 'This session'
  return (
    <TimeEditDialog
      title={`Edit time for ${pc.name}`}
      notes={
        <>
          <p className="m-0">{`Time left: ${getTimeLeftLabel(pc) ?? 'No limit set'}`}</p>
          {pc.status === 'frozen' && (
            <p className="m-0">The time stays paused until you unlock this PC.</p>
          )}
        </>
      }
      timeLimitLabel={pc.isOpenTime ? 'Set time limit' : 'Add time'}
      canTimeOut={canTimeOutPc(pc)}
      timeOutLabel="Time out – no time left"
      timeOutNote={`${sessionOwner} ends now and ${pc.name} returns to the login screen. Unsaved work may be lost.`}
      isBusy={isBusy}
      onConfirm={onConfirm}
      onTimeOut={onTimeOut}
      onCancel={onCancel}
    />
  )
}
