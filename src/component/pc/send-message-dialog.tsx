import { useId, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import {
  MAX_MESSAGE_LENGTH,
  sendMessageSchema,
  type SendMessageValues,
} from '../../lib/message-schema'
import {
  describeDeliverySummary,
  describeOfflineExclusion,
  describeMessageStatus,
  getUndeliveredResults,
} from '../../lib/messages'
import type { PcMessageDelivery } from '../../lib/messages-api'
import { formatPcCount } from '../../lib/pcs'
import type { RegisteredPc } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field, TextArea } from '../ui/field'
import { Modal } from '../ui/modal'

const BAD_REQUEST_STATUS = 400

interface SendMessageDialogProps {
  recipients: RegisteredPc[]
  offlineCount: number
  onSend: (text: string) => Promise<ApiResult<PcMessageDelivery[]>>
  onClose: () => void
}

export function SendMessageDialog({
  recipients,
  offlineCount,
  onSend,
  onClose,
}: SendMessageDialogProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const textId = `${baseId}-text`
  const countId = `${baseId}-count`
  const isSubmittingRef = useRef(false)
  const [deliveries, setDeliveries] = useState<PcMessageDelivery[] | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SendMessageValues>({
    mode: 'onChange',
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { text: '' },
  })
  const messageText = useWatch({ control, name: 'text' })

  async function sendText(values: SendMessageValues) {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    try {
      const result = await onSend(values.text)
      if (result.success) setDeliveries(result.data)
      else if (isSessionExpired(result)) return
      else if (result.status === BAD_REQUEST_STATUS) setError('text', { message: result.error })
      else setError('root', { message: result.error })
    } finally {
      isSubmittingRef.current = false
    }
  }

  function closeUnlessSending() {
    if (!isSubmitting) onClose()
  }

  const recipientNames = recipients.map((pc) => pc.name).join(', ')
  const offlineNote = describeOfflineExclusion(offlineCount)

  if (deliveries !== null) {
    const undelivered = getUndeliveredResults(deliveries)
    return (
      <Modal isOpen labelledBy={titleId} onClose={onClose}>
        <h2 id={titleId} className="m-0 mb-2 text-xl font-semibold">
          Message results
        </h2>
        <div className="mb-6 flex flex-col gap-4">
          <p role="status" className="m-0 text-base">
            {describeDeliverySummary(deliveries)}
          </p>
          {undelivered.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-xs font-semibold tracking-label text-ink-muted">
                Not delivered
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {undelivered.map((result) => (
                  <li
                    key={result.pcId}
                    className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-sm"
                  >
                    <span className="font-mono break-all">{result.pcName}</span>
                    <span className="text-ink-muted">
                      {describeMessageStatus(result.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    )
  }

  const describedBy = [errors.text && `${textId}-message`, countId].filter(Boolean).join(' ')

  return (
    <Modal isOpen labelledBy={titleId} onClose={closeUnlessSending}>
      <form noValidate onSubmit={(event) => handleSubmit(sendText)(event)}>
        <h2 id={titleId} className="m-0 mb-2 text-xl font-semibold">
          Send message
        </h2>
        <div className="mb-6 flex flex-col gap-4">
          <p className="m-0 text-base">
            <span className="font-semibold">To: </span>
            <span className="font-mono text-sm break-all">
              {recipientNames}
              {recipientNames && ` (${formatPcCount(recipients.length)})`}
            </span>
          </p>
          {offlineNote && <p className="m-0 text-sm text-ink-muted">{offlineNote}</p>}
          {errors.root && (
            <Banner variant="danger" icon="alert" role="alert">
              {errors.root.message}
            </Banner>
          )}
          <Field
            label="Message"
            htmlFor={textId}
            message={errors.text?.message}
            isError={Boolean(errors.text)}
          >
            <TextArea
              id={textId}
              rows={4}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={isSubmitting}
              hasError={Boolean(errors.text)}
              aria-describedby={describedBy}
              {...register('text')}
            />
          </Field>
          <p id={countId} className="m-0 self-end text-xs text-ink-muted">
            {messageText.length} / {MAX_MESSAGE_LENGTH}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || !isValid}>
            {isSubmitting ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
