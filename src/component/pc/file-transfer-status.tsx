import { useState } from 'react'
import { cva } from 'class-variance-authority'
import {
  describeBusyFileName,
  describeTransferDetail,
  describeTransferSummary,
  FILE_TRANSFER_DECISION_LABELS,
  FILE_TRANSFER_STATUS_LABELS,
  getCancellableTransfers,
  getExistingTransfers,
  isFinalTransferStatus,
} from '../../lib/file-transfers'
import type { FileTransfer, FileTransferDecision, FileTransferStatus } from '../../types'
import { FILE_TRANSFER_DECISIONS } from '../../types'
import { Badge, type BadgeVariant } from '../ui/badge'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import type { IconName } from '../ui/icon'
import { useFileTransfers } from './use-file-transfers'

interface TransferStatusDisplay {
  variant: BadgeVariant
  icon: IconName
}

const STATUS_DISPLAY: Record<FileTransferStatus, TransferStatusDisplay> = {
  waiting: { variant: 'file-waiting', icon: 'clock' },
  downloading: { variant: 'file-busy', icon: 'download' },
  exists: { variant: 'file-attention', icon: 'alert' },
  applying: { variant: 'file-busy', icon: 'hourglass' },
  saved: { variant: 'file-saved', icon: 'check' },
  skipped: { variant: 'file-skipped', icon: 'skip' },
  failed: { variant: 'file-failed', icon: 'alert' },
  expired: { variant: 'file-skipped', icon: 'clock' },
  cancelled: { variant: 'file-skipped', icon: 'x' },
}

const detailVariants = cva('m-0 break-words text-xs', {
  variants: {
    isError: {
      true: 'text-danger',
      false: 'text-ink-muted',
    },
  },
  defaultVariants: {
    isError: false,
  },
})

const ALL_DECISION_LABELS: Record<FileTransferDecision, string> = {
  overwrite: 'Overwrite all',
  keepBoth: 'Keep both for all',
  skip: 'Skip all',
}

interface DecisionButtonsProps {
  isDisabled: boolean
  getLabel: (decision: FileTransferDecision) => string
  onDecide: (decision: FileTransferDecision) => void
}

function DecisionButtons({ isDisabled, getLabel, onDecide }: DecisionButtonsProps) {
  return (
    <>
      {FILE_TRANSFER_DECISIONS.map((decision) => (
        <Button
          key={decision}
          variant={decision === 'overwrite' ? 'primary' : 'secondary'}
          size="sm"
          disabled={isDisabled}
          onClick={() => onDecide(decision)}
        >
          {getLabel(decision)}
        </Button>
      ))}
    </>
  )
}

// The busy line names the other file, cut short when long, with the full name on hover.
function BusyDetail({ transfer }: { transfer: FileTransfer }) {
  const busyFileName = describeBusyFileName(transfer)
  return (
    <p className={detailVariants()}>
      PC is still receiving{' '}
      <span title={busyFileName} className="inline-block max-w-full truncate align-bottom font-mono">
        {busyFileName}
      </span>
      .
    </p>
  )
}

function TransferDetail({ transfer }: { transfer: FileTransfer }) {
  if (transfer.status === 'waiting' && transfer.waitingReason === 'busy') {
    return <BusyDetail transfer={transfer} />
  }
  const detail = describeTransferDetail(transfer)
  if (!detail) return null
  return (
    <p title={detail} className={detailVariants({ isError: transfer.status === 'failed' })}>
      {detail}
    </p>
  )
}

interface TransferRowProps {
  transfer: FileTransfer
  isPosting: boolean
  onDecide: (decision: FileTransferDecision) => void
  onCancel: () => void
}

function TransferRow({ transfer, isPosting, onDecide, onCancel }: TransferRowProps) {
  const { variant, icon } = STATUS_DISPLAY[transfer.status]
  const isCancellable = !isFinalTransferStatus(transfer.status)

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span title={transfer.pcName} className="min-w-0 truncate font-mono text-sm">
          {transfer.pcName}
        </span>
        <Badge variant={variant} icon={icon}>
          {FILE_TRANSFER_STATUS_LABELS[transfer.status]}
        </Badge>
      </div>
      <TransferDetail transfer={transfer} />
      {transfer.status === 'exists' && (
        <div role="group" aria-label={`Choice for ${transfer.pcName}`} className="flex flex-wrap gap-2">
          <DecisionButtons
            isDisabled={isPosting}
            getLabel={(decision) => FILE_TRANSFER_DECISION_LABELS[decision]}
            onDecide={onDecide}
          />
        </div>
      )}
      {isCancellable && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Cancel sending to ${transfer.pcName}`}
            disabled={isPosting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      )}
    </li>
  )
}

interface CancelAllProps {
  count: number
  isDisabled: boolean
  onConfirm: () => void
}

// Asks once more in place, since this already sits inside the send dialog.
function CancelAll({ count, isDisabled, onConfirm }: CancelAllProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  if (!isConfirming) {
    return (
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" disabled={isDisabled} onClick={() => setIsConfirming(true)}>
          Cancel all ({count})
        </Button>
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label="Confirm cancel all"
      className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface-300 p-3"
    >
      <p className="m-0 text-sm">
        Stop sending this file to {count} PCs? Files already saved stay on their PCs.
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setIsConfirming(false)}>
          Keep sending
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={isDisabled}
          onClick={() => {
            setIsConfirming(false)
            onConfirm()
          }}
        >
          Cancel all ({count})
        </Button>
      </div>
    </div>
  )
}

interface FileTransferStatusProps {
  initialTransfers: FileTransfer[]
}

export function FileTransferStatus({ initialTransfers }: FileTransferStatusProps) {
  const { transfers, pollError, actionError, isPosting, decide, cancel } =
    useFileTransfers(initialTransfers)
  const existing = getExistingTransfers(transfers)
  const existingIds = existing.map((transfer) => transfer.id)
  const cancellableIds = getCancellableTransfers(transfers).map((transfer) => transfer.id)

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="m-0 text-base">
        {describeTransferSummary(transfers)}
      </p>

      {existing.length >= 2 && (
        <div
          role="group"
          aria-label={`Apply to all (${existing.length})`}
          className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface-300 p-3"
        >
          <p className="m-0 text-sm font-semibold">Apply to all ({existing.length})</p>
          <div className="flex flex-wrap gap-2">
            <DecisionButtons
              isDisabled={isPosting}
              getLabel={(decision) => ALL_DECISION_LABELS[decision]}
              onDecide={(decision) => void decide(existingIds, decision)}
            />
          </div>
        </div>
      )}

      {cancellableIds.length >= 2 && (
        <CancelAll
          count={cancellableIds.length}
          isDisabled={isPosting}
          onConfirm={() => void cancel(cancellableIds)}
        />
      )}

      {actionError && (
        <Banner variant="danger" icon="alert" role="alert">
          {actionError}
        </Banner>
      )}
      {pollError && <p className="m-0 text-xs text-ink-muted">{pollError}</p>}

      <ul aria-label="PCs" className="m-0 flex list-none flex-col p-0">
        {transfers.map((transfer) => (
          <TransferRow
            key={transfer.id}
            transfer={transfer}
            isPosting={isPosting}
            onDecide={(decision) => void decide([transfer.id], decision)}
            onCancel={() => void cancel([transfer.id])}
          />
        ))}
      </ul>
    </div>
  )
}
