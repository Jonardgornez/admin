import { useId, useState, type ChangeEvent } from 'react'
import type { ApiResult } from '../../lib/api'
import { BACKGROUND_ACCEPT, getBackgroundFileError } from '../../lib/background-schema'
import { BACKGROUND_FORMAT_NOTE, formatBackgroundSize } from '../../lib/backgrounds'
import { anyPcHasWallpaper, formatPcCount } from '../../lib/pcs'
import type { BulkCommandResult } from '../../lib/pcs-api'
import type { RegisteredPc } from '../../types'
import { BackgroundPreview } from '../settings/background-preview'
import { FILE_INPUT_CLASS } from '../settings/background-slot'
import { useChosenImage } from '../settings/use-chosen-image'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { Icon } from '../ui/icon'
import { Modal } from '../ui/modal'

type WallpaperPendingAction = 'apply' | 'remove'

type WallpaperCommandResult = ApiResult<BulkCommandResult> | null

interface WallpaperDialogProps {
  targetPcs: RegisteredPc[]
  isBusy: boolean
  // Null means the same bulk command is still running, so the dialog stays open until it ends.
  onApply: (file: File) => Promise<WallpaperCommandResult>
  onRemove: () => Promise<WallpaperCommandResult>
  onClose: () => void
}

export function WallpaperDialog({
  targetPcs,
  isBusy,
  onApply,
  onRemove,
  onClose,
}: WallpaperDialogProps) {
  const titleId = useId()
  const fileInputId = useId()
  const { chosen, choose } = useChosenImage()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<WallpaperPendingAction | null>(null)
  const countLabel = formatPcCount(targetPcs.length)
  const hasWallpaper = anyPcHasWallpaper(targetPcs)
  // Set as soon as a command starts, so every action stays off until it settles.
  const isCommandRunning = isBusy || pendingAction !== null
  const messageId = `${fileInputId}-message`

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

  async function runCommand(
    action: WallpaperPendingAction,
    command: () => Promise<WallpaperCommandResult>,
  ) {
    setPendingAction(action)
    setServerError(null)
    const result = await command()
    setPendingAction(null)
    if (result && !result.success) setServerError(result.error)
  }

  return (
    <Modal isOpen labelledBy={titleId} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="m-0 text-xl font-semibold">
            Wallpaper for {countLabel}
          </h2>
          <p className="m-0 min-w-0 break-words text-sm">
            <span className="font-semibold">To: </span>
            <span className="font-mono">{targetPcs.map((pc) => pc.name).join(', ')}</span>
          </p>
        </div>

        {chosen && (
          <>
            <BackgroundPreview src={chosen.previewUrl} alt="New wallpaper, not applied yet" />
            <p className="m-0 min-w-0 truncate text-sm text-ink-muted">
              New image: {chosen.file.name} · {formatBackgroundSize(chosen.file.size)}
            </p>
          </>
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
            disabled={isCommandRunning}
            className={FILE_INPUT_CLASS}
            aria-invalid={validationError !== null || undefined}
            aria-describedby={validationError !== null ? messageId : undefined}
            onChange={handleFileChange}
          />
        </Field>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <p className="m-0">Students can&apos;t change the wallpaper while it is set.</p>
          <p className="m-0">Offline PCs get the wallpaper when they come back online.</p>
        </div>

        {serverError && (
          <Banner variant="danger" icon="alert" role="alert">
            {serverError}
          </Banner>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {hasWallpaper && (
            <Button
              variant="secondary"
              disabled={isCommandRunning}
              className="mr-auto"
              onClick={() => void runCommand('remove', onRemove)}
            >
              <Icon name="x" />
              Remove wallpaper
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={chosen === null || isCommandRunning}
            onClick={() => {
              if (chosen) void runCommand('apply', () => onApply(chosen.file))
            }}
          >
            {pendingAction === 'apply' ? 'Applying...' : `Apply to ${countLabel}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
