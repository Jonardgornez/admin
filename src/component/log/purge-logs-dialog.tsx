import { useEffect, useId, useRef, useState } from 'react'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import { formatSessionCount } from '../../lib/logs'
import {
  PURGE_DAY_CHOICES,
  previewSessionLogPurge,
  purgeSessionLogs,
  type PurgeDays,
} from '../../lib/session-logs-api'
import { useSessionRequest } from '../auth/use-session-request'
import { ConfirmDialog } from '../ui/confirm-dialog'
import { Field, SelectInput } from '../ui/field'

const DEFAULT_DAYS: PurgeDays = 90

interface PurgeLogsDialogProps {
  onPurged: (deleted: number) => void
  onClose: () => void
}

interface PurgePreview {
  days: PurgeDays
  result: ApiResult<number>
}

function getConfirmLabel(isPurging: boolean, count: number | null): string {
  if (isPurging) return 'Deleting…'
  return count ? `Delete ${formatSessionCount(count)}` : 'Delete'
}

export function PurgeLogsDialog({ onPurged, onClose }: PurgeLogsDialogProps) {
  const selectId = useId()
  const request = useSessionRequest()
  const [days, setDays] = useState<PurgeDays>(DEFAULT_DAYS)
  const [preview, setPreview] = useState<PurgePreview | null>(null)
  const [isPurging, setIsPurging] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)
  const isPurgingRef = useRef(false)

  useEffect(() => {
    let isCurrent = true
    void request(previewSessionLogPurge(days)).then((result) => {
      if (isCurrent) setPreview({ days, result })
    })
    return () => {
      isCurrent = false
    }
  }, [request, days])

  // A preview for an earlier choice is still on screen until the new count arrives, so it counts as loading.
  const currentResult = preview?.days === days ? preview.result : null
  const count = currentResult?.success ? currentResult.data : null
  const previewError = currentResult && !currentResult.success && !isSessionExpired(currentResult)
    ? currentResult.error
    : null

  async function purge() {
    if (isPurgingRef.current) return
    isPurgingRef.current = true
    setIsPurging(true)
    setPurgeError(null)
    const result = await request(purgeSessionLogs(days))
    isPurgingRef.current = false
    setIsPurging(false)
    if (result.success) onPurged(result.data)
    else if (!isSessionExpired(result)) setPurgeError(result.error)
  }

  function chooseDays(value: string) {
    const chosen = PURGE_DAY_CHOICES.find((choice) => String(choice) === value)
    if (chosen) setDays(chosen)
  }

  return (
    <ConfirmDialog
      isOpen
      title="Purge old logs"
      confirmLabel={getConfirmLabel(isPurging, count)}
      isConfirmDisabled={isPurging || !count}
      onConfirm={() => void purge()}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-3">
        <Field label="Delete ended sessions on all PCs older than" htmlFor={selectId}>
          <SelectInput
            id={selectId}
            value={String(days)}
            disabled={isPurging}
            onChange={(event) => chooseDays(event.target.value)}
          >
            {PURGE_DAY_CHOICES.map((choice) => (
              <option key={choice} value={String(choice)}>
                {choice} days
              </option>
            ))}
          </SelectInput>
        </Field>
        <PurgeSummary days={days} count={count} error={previewError ?? purgeError} isLoading={!currentResult} />
      </div>
    </ConfirmDialog>
  )
}

interface PurgeSummaryProps {
  days: PurgeDays
  count: number | null
  error: string | null
  isLoading: boolean
}

function PurgeSummary({ days, count, error, isLoading }: PurgeSummaryProps) {
  if (error) {
    return (
      <p role="alert" className="m-0 text-sm font-semibold text-danger">
        {error}
      </p>
    )
  }
  if (isLoading || count === null) {
    return (
      <p role="status" className="m-0 text-sm">
        Counting sessions…
      </p>
    )
  }
  if (count === 0) {
    return (
      <p role="status" className="m-0 text-sm">
        No ended sessions started more than {days} days ago.
      </p>
    )
  }
  return (
    <p role="status" className="m-0 text-sm">
      This deletes {formatSessionCount(count)} on all PCs that started more than {days} days ago,
      whatever the filters show. Running sessions are kept. This can't be undone.
    </p>
  )
}
