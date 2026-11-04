import { useState } from 'react'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Field, TextArea } from '../ui/field'

interface SendMessageDialogProps {
  recipientNames: string[]
  onSend: () => void
  onCancel: () => void
}

export function SendMessageDialog({ recipientNames, onSend, onCancel }: SendMessageDialogProps) {
  const [messageText, setMessageText] = useState('')

  return (
    <ConfirmDialog
      isOpen
      title="Send message"
      confirmLabel="Send"
      confirmVariant="primary"
      isConfirmDisabled={messageText.trim() === ''}
      onConfirm={onSend}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0">
          <span className="font-semibold">To: </span>
          <span className="font-mono text-sm">{recipientNames.join(', ')}</span>
        </p>
        <Field label="Message" htmlFor="message-text">
          <TextArea
            id="message-text"
            rows={3}
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
          />
        </Field>
      </div>
    </ConfirmDialog>
  )
}
