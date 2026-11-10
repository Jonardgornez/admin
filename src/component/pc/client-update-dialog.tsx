import { formatClientVersion, formatReleaseUploaded } from '../../lib/client-updates'
import { formatPcCount } from '../../lib/pcs'
import type { ClientRelease } from '../../types'
import { Banner } from '../ui/banner'
import { ConfirmDialog } from '../ui/confirm-dialog'

// The PC ids and release are fixed when the dialog opens, so the confirmed update matches what was shown.
export interface ClientUpdateTarget {
  pcIds: number[]
  includesServerPc: boolean
  release: ClientRelease
}

interface ClientUpdateDialogProps {
  target: ClientUpdateTarget | null
  errorMessage: string | null
  isBusy: boolean
  onConfirm: () => void
  onCancel: () => void
}

const UPDATE_DESCRIPTION = 'Each PC installs it the next time nobody is using it.'
const SERVER_PC_NOTE = 'This includes the server PC.'
const FINGERPRINT_LENGTH = 12

export function ClientUpdateDialog({
  target,
  errorMessage,
  isBusy,
  onConfirm,
  onCancel,
}: ClientUpdateDialogProps) {
  const pcCountText = formatPcCount(target?.pcIds.length ?? 0)
  const release = target?.release

  return (
    <ConfirmDialog
      isOpen={target !== null}
      title={`Update ${pcCountText} to ${release?.version ?? ''}?`}
      confirmLabel="Update"
      confirmVariant="primary"
      isConfirmDisabled={isBusy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-2">
        <p className="m-0">{UPDATE_DESCRIPTION}</p>
        {release && (
          <p className="m-0 text-sm">
            {formatClientVersion(release.version)} · {formatReleaseUploaded(release.uploadedAtUtc)}{' '}
            · {release.sha256.slice(0, FINGERPRINT_LENGTH)}
          </p>
        )}
        {target?.includesServerPc && <p className="m-0 text-sm">{SERVER_PC_NOTE}</p>}
        {errorMessage && (
          <Banner variant="danger" icon="alert" role="alert">
            {errorMessage}
          </Banner>
        )}
      </div>
    </ConfirmDialog>
  )
}
