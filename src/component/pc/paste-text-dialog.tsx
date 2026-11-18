import { useId } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import {
  ALREADY_PASTING_MESSAGE,
  MAX_PASTE_LENGTH,
  normalizePasteText,
} from '../../lib/paste-text'
import {
  pasteTextSchema,
  type PasteTextInput,
  type PasteTextValues,
} from '../../lib/paste-text-schema'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field, TextArea } from '../ui/field'
import { Modal } from '../ui/modal'
import type { PasteTextResult } from './use-paste-text'

const MAX_LENGTH_TEXT = MAX_PASTE_LENGTH.toLocaleString('en-US')
const TYPING_NOTE =
  "The text is typed where the PC's cursor is. It's shown in plain view here — take care with passwords."
const CHARACTERS_NOTE = 'Line breaks and tabs are typed too; other control characters are left out.'

interface PasteTextDialogProps {
  pcName: string
  // Another paste is still being typed, so this one can't start yet.
  isSending: boolean
  onPasteText: (text: string) => PasteTextResult
  onClose: () => void
}

// Mounted only while open, so each opening starts with an empty text.
export function PasteTextDialog({ pcName, isSending, onPasteText, onClose }: PasteTextDialogProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const textId = `${baseId}-text`

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PasteTextInput, unknown, PasteTextValues>({
    resolver: zodResolver(pasteTextSchema),
    defaultValues: { text: '' },
  })
  const text = useWatch({ control, name: 'text' })
  const typedLength = normalizePasteText(text).length
  const counterText = `${typedLength.toLocaleString('en-US')}/${MAX_LENGTH_TEXT} characters`

  function typeOnPc(values: PasteTextValues) {
    const result = onPasteText(values.text)
    if (result.success) onClose()
    else setError('root', { message: result.error })
  }

  return (
    <Modal isOpen labelledBy={titleId} onClose={onClose}>
      <form noValidate onSubmit={(event) => void handleSubmit(typeOnPc)(event)}>
        <h2 id={titleId} className="m-0 mb-2 text-xl font-semibold">
          Paste text on <span className="font-mono">{pcName}</span>
        </h2>
        <div className="mb-4 flex flex-col gap-1 text-sm text-ink-muted">
          <p className="m-0">{TYPING_NOTE}</p>
          <p className="m-0">{CHARACTERS_NOTE}</p>
        </div>
        <div className="mb-6 flex flex-col gap-4">
          {isSending && (
            <Banner variant="info" icon="info" role="status">
              {ALREADY_PASTING_MESSAGE}
            </Banner>
          )}
          {errors.root && (
            <Banner variant="danger" icon="alert" role="alert">
              {errors.root.message}
            </Banner>
          )}
          <Field
            label="Text to type"
            htmlFor={textId}
            message={errors.text?.message ?? counterText}
            isError={Boolean(errors.text)}
          >
            <TextArea
              id={textId}
              rows={8}
              className="resize-y"
              autoComplete="off"
              spellCheck={false}
              hasError={Boolean(errors.text)}
              aria-describedby={`${textId}-message`}
              {...register('text')}
            />
          </Field>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSending}>
            Type on PC
          </Button>
        </div>
      </form>
    </Modal>
  )
}
