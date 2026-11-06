import { useId } from 'react'
import {
  describeAnswer,
  formatPairingNumber,
  getWaitingLabel,
  type RegistrationAction,
} from '../../lib/registration-requests'
import type { RegistrationRequest } from '../../lib/registration-requests-api'
import { Button } from '../ui/button'
import { Modal } from '../ui/modal'
import { useNotify } from '../ui/notification-context'
import { useRegistrationRequests } from './use-registration-requests'

// Has no close button or backdrop click on purpose: the only answers are Accept and Deny.
export function RegistrationRequestDialog() {
  const notify = useNotify()
  const titleId = useId()
  const { requests, isAnswering, answer } = useRegistrationRequests()
  const [oldestRequest] = requests

  if (oldestRequest === undefined) return null

  // The request is the one on screen when the button is clicked, so the answer always matches it.
  async function answerRequest(entry: RegistrationRequest, action: RegistrationAction) {
    const result = await answer(entry, action)
    if (result === null) return
    const notice = describeAnswer(action, entry.name, result)
    if (notice) notify(notice.message, notice.icon)
  }

  const waitingLabel = getWaitingLabel(requests.length)

  return (
    <Modal isOpen labelledBy={titleId}>
      <div className="flex flex-col gap-5">
        <h2 id={titleId} className="m-0 text-xl font-semibold">
          New PC wants to connect
        </h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          <dt className="text-ink-muted">PC name</dt>
          <dd className="m-0 font-mono font-semibold break-all">{oldestRequest.name}</dd>
          <dt className="text-ink-muted">IP address</dt>
          <dd className="m-0 font-mono">{oldestRequest.ipAddress ?? 'Unknown'}</dd>
        </dl>
        <div className="flex flex-col items-center gap-2 rounded-md border border-border-strong bg-surface-300 px-4 py-5 text-center">
          <p className="m-0 font-mono text-display font-semibold tracking-wider tabular-nums">
            {formatPairingNumber(oldestRequest.pairingNumber)}
          </p>
          <p className="m-0 text-base text-ink-muted">
            Accept only if this number matches the one on the PC.
          </p>
        </div>
        {waitingLabel && <p className="m-0 text-sm text-ink-muted">{waitingLabel}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            disabled={isAnswering}
            onClick={() => void answerRequest(oldestRequest, 'deny')}
          >
            Deny
          </Button>
          <Button
            variant="primary"
            disabled={isAnswering}
            onClick={() => void answerRequest(oldestRequest, 'accept')}
          >
            Accept
          </Button>
        </div>
      </div>
    </Modal>
  )
}
