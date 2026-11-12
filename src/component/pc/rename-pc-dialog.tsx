import { useId, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import {
  renamePcSchema,
  type RenamePcInput,
  type RenamePcValues,
} from '../../lib/pc-name-schema'
import { getPcNumberFromName, PC_NAME_PREFIX } from '../../lib/pcs'
import type { RenamedPc } from '../../lib/pcs-api'
import type { RegisteredPc } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field, TextInput } from '../ui/field'
import { Modal } from '../ui/modal'

const BAD_REQUEST_STATUS = 400
const NAME_TAKEN_STATUS = 409
const NUMBER_HINT = `The ${PC_NAME_PREFIX} prefix stays the same.`

interface RenamePcDialogProps {
  pc: RegisteredPc
  // The parent closes the dialog on success. A failure keeps it open with the error.
  onRename: (number: number) => Promise<ApiResult<RenamedPc>>
  onClose: () => void
}

export function RenamePcDialog({ pc, onRename, onClose }: RenamePcDialogProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const numberId = `${baseId}-number`
  const isSubmittingRef = useRef(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RenamePcInput, unknown, RenamePcValues>({
    resolver: zodResolver(renamePcSchema),
    defaultValues: { number: String(getPcNumberFromName(pc.name) ?? '') },
  })

  async function renameToNumber(values: RenamePcValues) {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    try {
      const result = await onRename(values.number)
      if (result.success || isSessionExpired(result)) return
      if (result.status === BAD_REQUEST_STATUS || result.status === NAME_TAKEN_STATUS) {
        setError('number', { message: result.error })
      } else {
        setError('root', { message: result.error })
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  function closeUnlessRenaming() {
    if (!isSubmitting) onClose()
  }

  return (
    <Modal isOpen labelledBy={titleId} onClose={closeUnlessRenaming}>
      <form noValidate onSubmit={(event) => handleSubmit(renameToNumber)(event)}>
        <h2 id={titleId} className="m-0 mb-2 text-xl font-semibold">
          Rename <span className="font-mono">{pc.name}</span>
        </h2>
        <div className="mb-6 flex flex-col gap-4">
          {errors.root && (
            <Banner variant="danger" icon="alert" role="alert">
              {errors.root.message}
            </Banner>
          )}
          <Field
            label="PC number"
            htmlFor={numberId}
            message={errors.number?.message ?? NUMBER_HINT}
            isError={Boolean(errors.number)}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className="font-mono text-base font-semibold text-ink-muted">
                {PC_NAME_PREFIX}
              </span>
              <TextInput
                id={numberId}
                isMono
                inputMode="numeric"
                autoComplete="off"
                disabled={isSubmitting}
                hasError={Boolean(errors.number)}
                aria-describedby={`${numberId}-message`}
                {...register('number')}
              />
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Renaming...' : 'Rename'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
