import type { RegisteredPc } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'

interface RemovePcDialogProps {
  pc: RegisteredPc | null
  onConfirm: () => void
  onCancel: () => void
}

export function RemovePcDialog({ pc, onConfirm, onCancel }: RemovePcDialogProps) {
  return (
    <ConfirmDialog
      isOpen={pc !== null}
      title={`Remove ${pc?.name ?? 'this PC'}?`}
      confirmLabel="Remove"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {pc?.name ?? 'This PC'} must register again to come back. This can't be undone.
    </ConfirmDialog>
  )
}
