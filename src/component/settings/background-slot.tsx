import { useId, useState, type ChangeEvent } from 'react'
import type { ApiResult } from '../../lib/api'
import {
  BACKGROUND_ACCEPT,
  getBackgroundFileError,
} from '../../lib/background-schema'
import {
  BACKGROUND_COPY,
  BACKGROUND_FORMAT_NOTE,
  formatBackgroundSize,
  formatBackgroundUpdated,
  type BackgroundKind,
} from '../../lib/backgrounds'
import { backgroundImageUrl, type BackgroundInfo } from '../../lib/backgrounds-api'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Field } from '../ui/field'
import { BackgroundPreview } from './background-preview'
import type { BackgroundActionType } from './use-screen-backgrounds'
import { useChosenImage } from './use-chosen-image'

export const FILE_INPUT_CLASS =
  'w-full min-w-0 cursor-pointer text-sm text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border-strong file:bg-surface-300 file:px-3 file:py-1.5 file:font-semibold file:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-disabled'

interface BackgroundSlotProps {
  kind: BackgroundKind
  info: BackgroundInfo | null
  busyAction: BackgroundActionType | undefined
  onSave: (file: File) => Promise<ApiResult<BackgroundInfo>>
  onDelete: () => Promise<ApiResult<undefined>>
}

export function BackgroundSlot({ kind, info, busyAction, onSave, onDelete }: BackgroundSlotProps) {
  const copy = BACKGROUND_COPY[kind]
  const titleLower = copy.title.toLowerCase()
  const fileInputId = useId()
  const titleId = useId()
  const { chosen, choose } = useChosenImage()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false)
  const isBusy = busyAction !== undefined

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    // Clearing the input lets the admin pick the same file again after a rejected choice.
    event.target.value = ''
    setServerError(null)
    if (file === null) {
      setValidationError(null)
      choose(null)
      return
    }
    const fileError = getBackgroundFileError(file)
    setValidationError(fileError)
    choose(fileError === null ? file : null)
  }

  function handleCancel() {
    setValidationError(null)
    setServerError(null)
    choose(null)
  }

  async function handleUpload() {
    if (!chosen) return
    setServerError(null)
    const result = await onSave(chosen.file)
    if (result.success) {
      choose(null)
    } else {
      setServerError(result.error)
    }
  }

  async function handleRemove() {
    setIsConfirmingRemove(false)
    setServerError(null)
    const result = await onDelete()
    if (!result.success) setServerError(result.error)
  }

  const previewSrc = chosen?.previewUrl ?? (info ? backgroundImageUrl(kind, info.sha256) : null)
  const previewAlt = chosen
    ? `New ${titleLower} image, not uploaded yet`
    : `Current ${titleLower} image`
  const messageId = `${fileInputId}-message`

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id={titleId} className="m-0 text-base font-semibold">
          {copy.title}
        </h3>
        <p className="m-0 text-sm text-ink-muted">{copy.hint}</p>
      </div>

      <BackgroundPreview src={previewSrc} alt={previewAlt} />

      {chosen ? (
        <p className="m-0 min-w-0 truncate text-sm text-ink-muted">
          New image: {chosen.file.name} · {formatBackgroundSize(chosen.file.size)}
        </p>
      ) : (
        info && (
          <p className="m-0 text-xs text-ink-muted">
            {formatBackgroundUpdated(info.updatedAtUtc)} · {formatBackgroundSize(info.sizeBytes)}
          </p>
        )
      )}

      <Field
        label="Choose image"
        htmlFor={fileInputId}
        message={validationError ?? BACKGROUND_FORMAT_NOTE}
        isError={validationError !== null}
      >
        <input
          id={fileInputId}
          type="file"
          accept={BACKGROUND_ACCEPT}
          disabled={isBusy}
          className={FILE_INPUT_CLASS}
          aria-invalid={validationError !== null || undefined}
          aria-describedby={validationError !== null ? messageId : undefined}
          onChange={handleFileChange}
        />
      </Field>

      {serverError && (
        <Banner variant="danger" icon="alert" role="alert">
          {serverError}
        </Banner>
      )}

      <div className="flex flex-wrap gap-2">
        {chosen && (
          <>
            <Button variant="primary" onClick={handleUpload} disabled={isBusy}>
              {busyAction === 'saving' ? 'Uploading...' : 'Upload'}
            </Button>
            <Button variant="secondary" onClick={handleCancel} disabled={isBusy}>
              Cancel
            </Button>
          </>
        )}
        {info && (
          <Button
            variant="danger"
            onClick={() => setIsConfirmingRemove(true)}
            disabled={isBusy}
          >
            {busyAction === 'removing' ? 'Removing...' : 'Remove'}
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmingRemove}
        title={`Remove the ${titleLower} image?`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setIsConfirmingRemove(false)}
      >
        PCs go back to the plain {titleLower} background.
      </ConfirmDialog>
    </section>
  )
}
