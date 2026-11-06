import { formatPcCount } from '../../lib/pcs'
import type { BulkLockKind } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'

// The PC ids are fixed when the dialog opens, so the confirmed count matches what was shown.
export interface BulkLockAction {
  kind: BulkLockKind
  pcIds: number[]
}

interface BulkLockDialogProps {
  action: BulkLockAction | null
  hiddenPcCount: number
  isBusy: boolean
  onConfirm: () => void
  onCancel: () => void
}

const LOCK_DESCRIPTION =
  "They show the locked screen until you unlock them. Students' sessions are kept and their time is paused. Offline PCs lock when they come back."
const UNLOCK_DESCRIPTION =
  'Locked PCs go back to their session, and PCs with no session open without a login. Offline PCs are skipped.'

export function BulkLockDialog({
  action,
  hiddenPcCount,
  isBusy,
  onConfirm,
  onCancel,
}: BulkLockDialogProps) {
  const isUnlock = action?.kind === 'unlock'
  const pcCountText = formatPcCount(action?.pcIds.length ?? 0)

  return (
    <ConfirmDialog
      isOpen={action !== null}
      title={isUnlock ? `Unlock ${pcCountText}?` : `Lock ${pcCountText}?`}
      confirmLabel={isUnlock ? 'Unlock' : 'Lock'}
      confirmVariant="primary"
      isConfirmDisabled={isBusy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {isUnlock ? UNLOCK_DESCRIPTION : LOCK_DESCRIPTION}
      {hiddenPcCount > 0 && ` ${formatPcCount(hiddenPcCount)} hidden by your search included.`}
    </ConfirmDialog>
  )
}
