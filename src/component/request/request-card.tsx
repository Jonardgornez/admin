import { useId, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import {
  approvalFormSchema,
  buildApprovalChoice,
  type ApprovalFormValues,
} from '../../lib/request-schemas'
import { formatRequestedAgo, formatRequestTime } from '../../lib/requests'
import type { ApprovalChoice, LoginRequest } from '../../types'
import { Button } from '../ui/button'
import { RadioOption } from '../ui/choice'
import { TextInput } from '../ui/field'
import { Icon } from '../ui/icon'

interface RequestCardProps {
  request: LoginRequest
  now: Date
  isBusy: boolean
  onApprove: (approval: ApprovalChoice) => Promise<void>
  onDeny: () => void
}

const DEFAULT_MINUTES = '60'

export function RequestCard({ request, now, isBusy, onApprove, onDeny }: RequestCardProps) {
  const minutesId = useId()
  const isSubmittingRef = useRef(false)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ApprovalFormValues>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: { approvalMode: 'time-limit', minutes: DEFAULT_MINUTES },
  })
  const approvalMode = useWatch({ control, name: 'approvalMode' })
  const isDisabled = isBusy || isSubmitting
  const isTimeLimit = approvalMode === 'time-limit'
  // The minutes are ignored for open time, so an old error about them is not shown.
  const minutesError = isTimeLimit ? errors.minutes?.message : undefined

  async function approve(values: ApprovalFormValues) {
    if (isSubmittingRef.current) return
    const choice = buildApprovalChoice(values)
    if (choice === null) return
    isSubmittingRef.current = true
    try {
      await onApprove(choice)
    } finally {
      isSubmittingRef.current = false
    }
  }

  return (
    <article className="rounded-lg border border-border-strong bg-surface-200 px-5 py-4 shadow-card">
      <form
        noValidate
        className="flex flex-wrap items-center gap-x-6 gap-y-4"
        onSubmit={(event) => handleSubmit(approve)(event)}
      >
        <div className="flex min-w-0 basis-50 flex-1 flex-col gap-0.5">
          <h2 className="m-0 font-mono text-lg font-semibold break-words">{request.pcName}</h2>
          <span className="text-sm text-ink-muted">
            Requested at {formatRequestTime(request.requestedAt)} ·{' '}
            {formatRequestedAgo(request.requestedAt, now)}
          </span>
        </div>
        <fieldset
          disabled={isDisabled}
          className="m-0 flex min-w-0 flex-wrap items-start gap-x-4 gap-y-3 border-0 p-0"
        >
          <legend className="sr-only">Approve as</legend>
          <div className="flex min-h-control-md items-center">
            <RadioOption value="time-limit" {...register('approvalMode')}>
              Time limit
            </RadioOption>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="inline-flex items-center gap-2">
              <TextInput
                id={minutesId}
                type="number"
                min={1}
                step={1}
                disabled={!isTimeLimit}
                hasError={minutesError !== undefined}
                aria-label={`Minutes for ${request.pcName}`}
                aria-describedby={minutesError ? `${minutesId}-message` : undefined}
                className="w-20"
                {...register('minutes')}
              />
              <span className="text-ink-muted">min</span>
            </span>
            {minutesError && (
              <p id={`${minutesId}-message`} className="m-0 text-xs font-semibold text-danger">
                {minutesError}
              </p>
            )}
          </div>
          <div className="flex min-h-control-md items-center">
            <RadioOption value="open-time" {...register('approvalMode')}>
              Open time
            </RadioOption>
          </div>
        </fieldset>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={isDisabled}>
            <Icon name="check" />
            Approve
          </Button>
          <Button type="button" variant="secondary" disabled={isDisabled} onClick={onDeny}>
            Deny
          </Button>
        </div>
      </form>
    </article>
  )
}
