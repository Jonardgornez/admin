import { canTimeOutPc, formatPcCount } from '../../lib/pcs'
import type { ApprovalChoice, RegisteredPc } from '../../types'
import { TimeEditDialog } from './time-edit-dialog'

interface BulkTimeDialogProps {
  pcs: RegisteredPc[]
  isBusy: boolean
  onConfirm: (choice: ApprovalChoice) => void
  onTimeOut: () => void
  onCancel: () => void
}

// Only PCs in use can time out. Locked PCs keep their session, so the server skips them.
export function BulkTimeDialog({ pcs, isBusy, onConfirm, onTimeOut, onCancel }: BulkTimeDialogProps) {
  const timeOutCount = pcs.filter(canTimeOutPc).length
  const hasLockedPcs = pcs.some((pc) => pc.status === 'frozen')
  return (
    <TimeEditDialog
      title={`Edit time for ${formatPcCount(pcs.length)}`}
      notes={
        hasLockedPcs && <p className="m-0">Locked PCs keep their time paused until you unlock them.</p>
      }
      timeLimitLabel="Add time"
      canTimeOut={timeOutCount > 0}
      timeOutLabel="Time out – end all selected sessions now"
      timeOutNote={`${formatPcCount(timeOutCount)} in use will end now and return to the login screen. Unsaved work may be lost. Locked PCs are skipped.`}
      isBusy={isBusy}
      onConfirm={onConfirm}
      onTimeOut={onTimeOut}
      onCancel={onCancel}
    />
  )
}
