import { formatPcCount } from '../../lib/pcs'
import type { InternetAction } from '../../types'
import { ConfirmDialog } from '../ui/confirm-dialog'

interface InternetDialogProps {
  action: InternetAction | null
  hiddenPcCount: number
  isBusy: boolean
  onConfirm: () => void
  onCancel: () => void
}

const OFF_DESCRIPTION = 'They keep reaching the Lykantra server and the lab network.'
const ON_DESCRIPTION = 'Each PC applies the change when it is online.'

// The PC ids are fixed when the dialog opens, so the confirmed count matches what was shown.
export function InternetDialog({
  action,
  hiddenPcCount,
  isBusy,
  onConfirm,
  onCancel,
}: InternetDialogProps) {
  const isBlocking = action?.blocked === true
  const pcCountText = formatPcCount(action?.pcIds.length ?? 0)

  return (
    <ConfirmDialog
      isOpen={action !== null}
      title={
        isBlocking
          ? `Turn off internet on ${pcCountText}?`
          : `Turn internet back on for ${pcCountText}?`
      }
      confirmLabel={isBlocking ? 'Turn off' : 'Turn on'}
      confirmVariant={isBlocking ? 'danger' : 'primary'}
      isConfirmDisabled={isBusy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {isBlocking ? OFF_DESCRIPTION : ON_DESCRIPTION}
      {hiddenPcCount > 0 && ` ${formatPcCount(hiddenPcCount)} hidden by your search included.`}
    </ConfirmDialog>
  )
}
