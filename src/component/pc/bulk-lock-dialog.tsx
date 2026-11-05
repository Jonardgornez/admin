import { formatPcCount } from '../../lib/pcs'
import type { BulkLockKind } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'

export interface BulkLockAction {
  kind: BulkLockKind
  count: number
}

interface BulkLockDialogProps {
  action: BulkLockAction | null
  isBusy: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function BulkLockDialog({ action, isBusy, onConfirm, onCancel }: BulkLockDialogProps) {
  const isUnlock = action?.kind === 'unlock'
  const pcCountText = formatPcCount(action?.count ?? 0)

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
      {isUnlock
        ? 'They open without a login and stay open until someone locks them or logs out.'
        : 'Anyone using them returns to the login screen.'}
    </ConfirmDialog>
  )
}
