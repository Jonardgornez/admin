import {
  formatClientVersion,
  formatReleaseUploaded,
  INSTALL_NOW_WARNING_SECONDS,
} from '../../lib/client-updates'
import { formatPcCount } from '../../lib/pcs'
import type { ClientRelease } from '../../types'
import { Banner } from '../ui/banner'
import { Checkbox } from '../ui/choice'
import { ConfirmDialog } from '../ui/confirm-dialog'

// The PC ids, release and install-now choice are fixed when the dialog opens, so the confirmed update matches what was shown.
export interface ClientUpdateTarget {
  pcIds: number[]
  includesServerPc: boolean
  release: ClientRelease
  installNow: boolean
}

interface ClientUpdateDialogProps {
  target: ClientUpdateTarget | null
  errorMessage: string | null
  isBusy: boolean
  onInstallNowChange: (installNow: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}

const UPDATE_DESCRIPTION = 'Each PC installs it the next time nobody is using it.'
const INSTALL_NOW_DESCRIPTION = `Students on PCs in use get a ${INSTALL_NOW_WARNING_SECONDS}-second warning, then are signed out so the update can install. A locked PC still waits until it is unlocked.`
const INSTALL_NOW_LABEL = `Install now, even if someone is using the PC (signs them out after a ${INSTALL_NOW_WARNING_SECONDS}-second warning)`
const SERVER_PC_NOTE = 'This includes the server PC.'
const FINGERPRINT_LENGTH = 12

export function ClientUpdateDialog({
  target,
  errorMessage,
  isBusy,
  onInstallNowChange,
  onConfirm,
  onCancel,
}: ClientUpdateDialogProps) {
  const pcCountText = formatPcCount(target?.pcIds.length ?? 0)
  const release = target?.release
  const isInstallNow = target?.installNow ?? false

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
        <p className="m-0">{isInstallNow ? INSTALL_NOW_DESCRIPTION : UPDATE_DESCRIPTION}</p>
        <label className="flex items-start gap-2 text-sm text-ink">
          <Checkbox
            className="mt-0.5"
            checked={isInstallNow}
            disabled={isBusy}
            onChange={(event) => onInstallNowChange(event.target.checked)}
          />
          {INSTALL_NOW_LABEL}
        </label>
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
