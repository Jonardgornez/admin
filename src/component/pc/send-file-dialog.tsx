import { useEffect, useId, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { isSessionExpired } from '../../lib/auth-state'
import { formatFileSize, getSendFileTargetLimitError } from '../../lib/file-transfers'
import { formatPcCount } from '../../lib/pcs'
import {
  DEFAULT_SHARE_SUBFOLDER,
  formatSharePath,
  getShareFileName,
  sendFileSchema,
  SHARE_FOLDER_LABELS,
  type SendFileInput,
  type SendFileValues,
} from '../../lib/send-file-schema'
import { sendFileToPcs, uploadSharedFile } from '../../lib/shared-files-api'
import { SHARE_FOLDERS, type FileTransfer, type RegisteredPc } from '../../types'
import { useSessionRequest } from '../auth/use-session-request'
import { FILE_INPUT_CLASS } from '../settings/background-slot'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field, SelectInput, TextInput } from '../ui/field'
import { Modal } from '../ui/modal'
import { FileTransferStatus } from './file-transfer-status'

const BAD_REQUEST_STATUS = 400

interface SentFile {
  name: string
  transfers: FileTransfer[]
}

interface UploadProgressProps {
  percent: number | null
  onCancel: () => void
}

// Null percent means the upload finished and the server is creating the transfers.
function UploadProgress({ percent, onCancel }: UploadProgressProps) {
  const label = percent === null ? 'Sending to PCs…' : `Uploading… ${percent}%`
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span aria-live="polite">{label}</span>
        {percent !== null && (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel upload
          </Button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? 100}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-300"
      >
        <div className="h-full bg-brand transition-all" style={{ width: `${percent ?? 100}%` }} />
      </div>
    </div>
  )
}

interface SendFileDialogProps {
  targetPcs: RegisteredPc[]
  onClose: () => void
}

export function SendFileDialog({ targetPcs, onClose }: SendFileDialogProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const fileId = `${baseId}-file`
  const folderId = `${baseId}-folder`
  const subfolderId = `${baseId}-subfolder`
  const request = useSessionRequest()
  const isSubmittingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const [uploadPercent, setUploadPercent] = useState<number | null>(null)
  const [sentFile, setSentFile] = useState<SentFile | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SendFileInput, unknown, SendFileValues>({
    resolver: zodResolver(sendFileSchema),
    defaultValues: { folder: 'desktop', subfolder: DEFAULT_SHARE_SUBFOLDER },
  })
  const [file, folder, subfolder] = useWatch({ control, name: ['file', 'folder', 'subfolder'] })

  // Closing the dialog mid-upload stops the upload.
  useEffect(() => () => abortRef.current?.abort(), [])

  async function uploadAndSend(values: SendFileValues) {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setUploadPercent(0)
    try {
      const upload = await request(
        uploadSharedFile(values.file, { onProgress: setUploadPercent, signal: controller.signal }),
      )
      if (controller.signal.aborted || isSessionExpired(upload)) return
      if (!upload.success) {
        setError(upload.status === BAD_REQUEST_STATUS ? 'file' : 'root', { message: upload.error })
        return
      }
      setUploadPercent(null)
      const sent = await request(
        sendFileToPcs({
          ids: targetPcs.map((pc) => pc.id),
          sharedFileId: upload.data.id,
          folder: values.folder,
          subfolder: values.subfolder,
        }),
      )
      if (sent.success) setSentFile({ name: upload.data.name, transfers: sent.data })
      else if (!isSessionExpired(sent)) setError('root', { message: sent.error })
    } finally {
      abortRef.current = null
      isSubmittingRef.current = false
      setUploadPercent(null)
    }
  }

  function cancelUpload() {
    abortRef.current?.abort()
  }

  function closeDialog() {
    cancelUpload()
    onClose()
  }

  const countLabel = formatPcCount(targetPcs.length)
  const targetLimitError = getSendFileTargetLimitError(targetPcs.length)

  if (sentFile) {
    return (
      <Modal isOpen labelledBy={titleId} onClose={onClose}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="m-0 text-xl font-semibold">
              Sending file to {countLabel}
            </h2>
            <p title={sentFile.name} className="m-0 min-w-0 truncate font-mono text-sm">
              {sentFile.name}
            </p>
          </div>
          <FileTransferStatus initialTransfers={sentFile.transfers} />
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const chosenFileName = file instanceof File ? getShareFileName(file.name) : undefined
  const pathPreview = formatSharePath(folder ?? 'desktop', subfolder ?? '', chosenFileName)

  return (
    <Modal isOpen labelledBy={titleId} onClose={closeDialog}>
      <form noValidate onSubmit={(event) => handleSubmit(uploadAndSend)(event)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="m-0 text-xl font-semibold">
              Send file to {countLabel}
            </h2>
            <p className="m-0 min-w-0 break-words text-sm">
              <span className="font-semibold">To: </span>
              <span className="font-mono">{targetPcs.map((pc) => pc.name).join(', ')}</span>
            </p>
          </div>

          {targetLimitError && (
            <p role="alert" className="m-0 text-sm font-semibold text-danger">
              {targetLimitError}
            </p>
          )}
          {errors.root && (
            <Banner variant="danger" icon="alert" role="alert">
              {errors.root.message}
            </Banner>
          )}

          <Field
            label="File"
            htmlFor={fileId}
            message={errors.file?.message}
            isError={Boolean(errors.file)}
          >
            <Controller
              control={control}
              name="file"
              render={({ field }) => (
                <input
                  id={fileId}
                  ref={field.ref}
                  name={field.name}
                  type="file"
                  disabled={isSubmitting}
                  className={FILE_INPUT_CLASS}
                  aria-invalid={errors.file ? true : undefined}
                  aria-describedby={errors.file ? `${fileId}-message` : undefined}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.files?.[0])}
                />
              )}
            />
          </Field>
          {file instanceof File && (
            <p title={file.name} className="m-0 min-w-0 truncate text-sm text-ink-muted">
              {file.name} · {formatFileSize(file.size)}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Folder" htmlFor={folderId}>
              <SelectInput id={folderId} disabled={isSubmitting} {...register('folder')}>
                {SHARE_FOLDERS.map((shareFolder) => (
                  <option key={shareFolder} value={shareFolder}>
                    {SHARE_FOLDER_LABELS[shareFolder]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field
              label="Subfolder"
              htmlFor={subfolderId}
              message={errors.subfolder?.message}
              isError={Boolean(errors.subfolder)}
            >
              <TextInput
                id={subfolderId}
                disabled={isSubmitting}
                hasError={Boolean(errors.subfolder)}
                aria-describedby={errors.subfolder ? `${subfolderId}-message` : undefined}
                {...register('subfolder')}
              />
            </Field>
          </div>

          <p className="m-0 min-w-0 text-sm">
            <span className="font-semibold">Saved to: </span>
            <span title={pathPreview} className="font-mono break-all">
              {pathPreview}
            </span>
          </p>
          <p className="m-0 text-sm text-ink-muted">
            PCs that are offline get the file if they come back online within 1 hour.
          </p>

          {isSubmitting && <UploadProgress percent={uploadPercent} onCancel={cancelUpload} />}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || targetLimitError !== undefined}
            >
              {isSubmitting ? 'Sending…' : `Send to ${countLabel}`}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
