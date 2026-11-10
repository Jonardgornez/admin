import { useId, useState, type ChangeEvent } from 'react'
import type { ApiResult } from '../../lib/api'
import { CLIENT_INSTALLER_ACCEPT, getClientInstallerFileError } from '../../lib/client-update-schema'
import { formatInstallerSize, INSTALLER_FORMAT_NOTE } from '../../lib/client-updates'
import type { ClientRelease } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field } from '../ui/field'

const FILE_INPUT_CLASS =
  'w-full min-w-0 cursor-pointer text-sm text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-border-strong file:bg-surface-300 file:px-3 file:py-1.5 file:font-semibold file:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-disabled'

interface ClientInstallerUploadProps {
  isUploading: boolean
  onUpload: (file: File) => Promise<ApiResult<ClientRelease> | null>
}

export function ClientInstallerUpload({ isUploading, onUpload }: ClientInstallerUploadProps) {
  const fileInputId = useId()
  const [chosenFile, setChosenFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    // Clearing the input lets the admin pick the same file again after a rejected choice.
    event.target.value = ''
    setServerError(null)
    if (file === null) {
      setValidationError(null)
      setChosenFile(null)
      return
    }
    const fileError = getClientInstallerFileError(file)
    setValidationError(fileError)
    setChosenFile(fileError === null ? file : null)
  }

  async function handleUpload() {
    if (!chosenFile) return
    setServerError(null)
    const result = await onUpload(chosenFile)
    // Null means another upload is still running, so this one is not sent.
    if (!result) return
    if (result.success) setChosenFile(null)
    else setServerError(result.error)
  }

  const messageId = `${fileInputId}-message`

  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Choose installer"
        htmlFor={fileInputId}
        message={validationError ?? INSTALLER_FORMAT_NOTE}
        isError={validationError !== null}
      >
        <input
          id={fileInputId}
          type="file"
          accept={CLIENT_INSTALLER_ACCEPT}
          disabled={isUploading}
          className={FILE_INPUT_CLASS}
          aria-invalid={validationError !== null || undefined}
          aria-describedby={validationError !== null ? messageId : undefined}
          onChange={handleFileChange}
        />
      </Field>

      {chosenFile && (
        <>
          <p className="m-0 min-w-0 truncate text-sm text-ink-muted">
            New installer: {chosenFile.name} · {formatInstallerSize(chosenFile.size)}
          </p>
          <div>
            <Button variant="primary" onClick={handleUpload} disabled={isUploading}>
              {isUploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </>
      )}

      {serverError && (
        <Banner variant="danger" icon="alert" role="alert">
          {serverError}
        </Banner>
      )}
    </div>
  )
}
