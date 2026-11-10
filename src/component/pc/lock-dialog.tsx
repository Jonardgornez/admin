import { useState } from 'react'
import {
  getPcLockMessageError,
  MAX_LOCK_MESSAGE_LENGTH,
  toPcLockMessage,
} from '../../lib/lock-message-schema'
import { formatPcCount } from '../../lib/pcs'
import { getLockActionPcIds, type LockAction } from '../../lib/pc-lock-action'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Field, TextArea } from '../ui/field'

interface LockDialogProps {
  action: LockAction
  // The message the PC shows when the admin leaves the message empty.
  defaultMessage: string
  hiddenPcCount: number
  isBusy: boolean
  // Null means no custom message, so the PC shows the default from Settings.
  onConfirm: (message: string | null) => void
  onCancel: () => void
}

const LOCK_DESCRIPTION =
  "They show the locked screen until you unlock them. Students' sessions are kept and their time is paused. Offline PCs are skipped."
const UNLOCK_DESCRIPTION =
  'Locked PCs go back to their session, and PCs with no session open without a login. Offline PCs are skipped.'

// Mounted only while open, so each opening starts with an empty message.
export function LockDialog({
  action,
  defaultMessage,
  hiddenPcCount,
  isBusy,
  onConfirm,
  onCancel,
}: LockDialogProps) {
  const [messageText, setMessageText] = useState('')
  const isUnlock = action.kind === 'unlock'
  const pcCountText = formatPcCount(getLockActionPcIds(action).length)
  const messageError = isUnlock ? null : getPcLockMessageError(messageText)
  const counterText = `${messageText.trim().length}/${MAX_LOCK_MESSAGE_LENGTH}`

  return (
    <ConfirmDialog
      isOpen
      title={isUnlock ? `Unlock ${pcCountText}?` : `Lock ${pcCountText}?`}
      confirmLabel={isUnlock ? 'Unlock' : 'Lock'}
      confirmVariant="primary"
      isConfirmDisabled={isBusy || messageError !== null}
      onConfirm={() => onConfirm(isUnlock ? null : toPcLockMessage(messageText))}
      onCancel={onCancel}
    >
      {isUnlock ? UNLOCK_DESCRIPTION : LOCK_DESCRIPTION}
      {hiddenPcCount > 0 && ` ${formatPcCount(hiddenPcCount)} hidden by your search included.`}
      {!isUnlock && (
        <Field
          label="Message on the PC (optional)"
          htmlFor="lock-message"
          className="mt-4"
          message={messageError ?? counterText}
          isError={messageError !== null}
        >
          <TextArea
            id="lock-message"
            rows={3}
            className="resize-y"
            placeholder={defaultMessage}
            value={messageText}
            hasError={messageError !== null}
            aria-describedby={messageError ? 'lock-message-message' : undefined}
            onChange={(event) => setMessageText(event.target.value)}
          />
        </Field>
      )}
    </ConfirmDialog>
  )
}
