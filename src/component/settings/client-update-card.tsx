import { useState } from 'react'
import {
  CLIENT_UPDATE_HINT,
  formatClientVersion,
  formatInstallerSize,
  formatReleaseUploaded,
  REMOVE_RELEASE_BODY,
} from '../../lib/client-updates'
import type { ClientRelease } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Icon } from '../ui/icon'
import { ClientInstallerUpload } from './client-installer-upload'
import { SettingsCard } from './settings-card'
import { useClientRelease } from './use-client-release'

function ClientReleaseSummary({ release }: { release: ClientRelease | null }) {
  if (!release) {
    return <p className="m-0 text-base text-ink-muted">No update uploaded.</p>
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 text-base font-semibold">{formatClientVersion(release.version)}</p>
      <p className="m-0 text-sm text-ink-muted">
        {formatInstallerSize(release.sizeBytes)} · {formatReleaseUploaded(release.uploadedAtUtc)}
      </p>
    </div>
  )
}

export function ClientUpdateCard() {
  const { loadState, retry, busyAction, uploadRelease, removeRelease } = useClientRelease()
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const isBusy = busyAction !== null

  async function handleRemove() {
    setIsConfirmingRemove(false)
    setRemoveError(null)
    const result = await removeRelease()
    if (result && !result.success) setRemoveError(result.error)
  }

  return (
    <SettingsCard title="Client updates">
      <p className="m-0 text-sm text-ink-muted">{CLIENT_UPDATE_HINT}</p>

      {loadState.status === 'loading' && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading client update...
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner
            variant="danger"
            icon="alert"
            title="Can't load the client update"
            role="alert"
            className="w-full"
          >
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={retry}>
            <Icon name="refresh" />
            Retry
          </Button>
        </div>
      )}
      {loadState.status === 'loaded' && (
        <div className="flex flex-col gap-5">
          <ClientReleaseSummary release={loadState.release} />
          <ClientInstallerUpload
            isUploading={busyAction === 'uploading'}
            onUpload={uploadRelease}
          />
          {loadState.release && (
            <div className="flex flex-col items-start gap-3">
              <Button variant="danger" onClick={() => setIsConfirmingRemove(true)} disabled={isBusy}>
                {busyAction === 'removing' ? 'Removing...' : 'Remove'}
              </Button>
              {removeError && (
                <Banner variant="danger" icon="alert" role="alert" className="w-full">
                  {removeError}
                </Banner>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmingRemove}
        title="Remove the client update?"
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setIsConfirmingRemove(false)}
      >
        {REMOVE_RELEASE_BODY}
      </ConfirmDialog>
    </SettingsCard>
  )
}
