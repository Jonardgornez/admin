import { getPcConfirmation } from '../../lib/pc-confirmation'
import type { Pc, PendingPcAction } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'

interface PcConfirmDialogProps {
  action: PendingPcAction | null
  pcs: Pc[]
  countdownSeconds: number | null
  onConfirm: () => void
  onCancel: () => void
}

export function PcConfirmDialog({
  action,
  pcs,
  countdownSeconds,
  onConfirm,
  onCancel,
}: PcConfirmDialogProps) {
  const confirmation = action ? getPcConfirmation(action, pcs, countdownSeconds) : null

  return (
    <ConfirmDialog
      isOpen={action !== null}
      title={confirmation?.title ?? ''}
      confirmLabel={confirmation?.confirmLabel ?? ''}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {confirmation?.body}
    </ConfirmDialog>
  )
}
