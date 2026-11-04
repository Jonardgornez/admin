import { useState } from 'react'
import type { ApprovalChoice, LoginRequest } from '../../types'
import { Button } from '../ui/button'
import { RadioOption } from '../ui/choice'
import { TextInput } from '../ui/field'
import { Icon } from '../ui/icon'

interface RequestCardProps {
  request: LoginRequest
  onApprove: (approval: ApprovalChoice) => void
  onDeny: () => void
}

type ApprovalMode = ApprovalChoice['mode']

const DEFAULT_MINUTES = '60'

export function RequestCard({ request, onApprove, onDeny }: RequestCardProps) {
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('time-limit')
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES)
  const groupName = `approval-${request.id}`

  function approve() {
    onApprove(
      approvalMode === 'open-time'
        ? { mode: 'open-time' }
        : { mode: 'time-limit', minutes: Number(minutes) },
    )
  }

  return (
    <article className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border border-border-strong bg-surface-200 px-5 py-4 shadow-card">
      <div className="flex basis-50 flex-1 flex-col gap-0.5">
        <h2 className="m-0 font-mono text-lg font-semibold">{request.pcName}</h2>
        <span className="text-sm text-ink-muted">
          Requested at {request.requestedAt} · {request.requestedAgo}
        </span>
      </div>
      <fieldset className="m-0 flex flex-wrap items-center gap-x-4 gap-y-3 border-0 p-0">
        <legend className="sr-only">Approve as</legend>
        <RadioOption
          name={groupName}
          value="time-limit"
          checked={approvalMode === 'time-limit'}
          onChange={() => setApprovalMode('time-limit')}
        >
          Time limit
        </RadioOption>
        <span className="inline-flex items-center gap-2">
          <TextInput
            type="number"
            min={1}
            value={minutes}
            aria-label={`Minutes for ${request.pcName}`}
            className="w-20"
            onChange={(event) => setMinutes(event.target.value)}
          />
          <span className="text-ink-muted">min</span>
        </span>
        <RadioOption
          name={groupName}
          value="open-time"
          checked={approvalMode === 'open-time'}
          onChange={() => setApprovalMode('open-time')}
        >
          Open time
        </RadioOption>
      </fieldset>
      <div className="flex gap-2">
        <Button variant="primary" onClick={approve}>
          <Icon name="check" />
          Approve
        </Button>
        <Button variant="secondary" onClick={onDeny}>
          Deny
        </Button>
      </div>
    </article>
  )
}
