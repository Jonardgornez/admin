import { getPcConfirmation } from '../../lib/pc-confirmation'
import { formatPcCount } from '../../lib/pcs'
import type { Pc, PendingPcAction, PowerCommand, RegisteredPc } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'

// The PCs are fixed when the dialog opens, so the confirmed list matches what was shown.
export type PowerAction =
  | { kind: PowerCommand; pc: RegisteredPc }
  | { kind: `${PowerCommand}-selected`; pcIds: number[]; pcNames: string[] }

interface PowerDialogProps {
  action: PowerAction | null
  pcs: Pc[]
  hiddenPcCount: number
  isBusy: boolean
  onConfirm: () => void
  onCancel: () => void
}

const NOT_STOPPABLE_NOTE = 'Neither you nor the student can stop it once you confirm.'

function toPendingPcAction(action: PowerAction): PendingPcAction {
  if ('pc' in action) return { kind: action.kind, pcName: action.pc.name }
  return { kind: action.kind, pcNames: action.pcNames }
}

export function PowerDialog({
  action,
  pcs,
  hiddenPcCount,
  isBusy,
  onConfirm,
  onCancel,
}: PowerDialogProps) {
  const confirmation = action ? getPcConfirmation(toPendingPcAction(action), pcs) : null
  const hiddenNote =
    hiddenPcCount > 0 ? `${formatPcCount(hiddenPcCount)} hidden by your search included.` : ''

  return (
    <ConfirmDialog
      isOpen={action !== null}
      title={confirmation?.title ?? ''}
      confirmLabel={confirmation?.confirmLabel ?? ''}
      confirmVariant="danger"
      isConfirmDisabled={isBusy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {[confirmation?.body, NOT_STOPPABLE_NOTE, hiddenNote].filter(Boolean).join(' ')}
    </ConfirmDialog>
  )
}
