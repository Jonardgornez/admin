import { cva } from 'class-variance-authority'
import {
  describeTransferDetail,
  describeTransferSummary,
  FILE_TRANSFER_DECISION_LABELS,
  FILE_TRANSFER_STATUS_LABELS,
  getExistingTransfers,
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

interface TransferRowProps {
  transfer: FileTransfer
  isDeciding: boolean
  onDecide: (decision: FileTransferDecision) => void
}

function TransferRow({ transfer, isDeciding, onDecide }: TransferRowProps) {
  const { variant, icon } = STATUS_DISPLAY[transfer.status]
  const detail = describeTransferDetail(transfer)

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
      {detail && (
        <p
          title={detail}
          className={detailVariants({ isError: transfer.status === 'failed' })}
        >
          {detail}
        </p>
      )}
      {transfer.status === 'exists' && (
        <div role="group" aria-label={`Choice for ${transfer.pcName}`} className="flex flex-wrap gap-2">
          <DecisionButtons
            isDisabled={isDeciding}
            getLabel={(decision) => FILE_TRANSFER_DECISION_LABELS[decision]}
            onDecide={onDecide}
          />
        </div>
      )}
    </li>
  )
}

interface FileTransferStatusProps {
  initialTransfers: FileTransfer[]
}

export function FileTransferStatus({ initialTransfers }: FileTransferStatusProps) {
  const { transfers, pollError, decisionError, isDeciding, decide } =
    useFileTransfers(initialTransfers)
  const existing = getExistingTransfers(transfers)
  const existingIds = existing.map((transfer) => transfer.id)

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
              isDisabled={isDeciding}
              getLabel={(decision) => ALL_DECISION_LABELS[decision]}
              onDecide={(decision) => void decide(existingIds, decision)}
            />
          </div>
        </div>
      )}

      {decisionError && (
        <Banner variant="danger" icon="alert" role="alert">
          {decisionError}
        </Banner>
      )}
      {pollError && <p className="m-0 text-xs text-ink-muted">{pollError}</p>}

      <ul aria-label="PCs" className="m-0 flex list-none flex-col p-0">
        {transfers.map((transfer) => (
          <TransferRow
            key={transfer.id}
            transfer={transfer}
            isDeciding={isDeciding}
            onDecide={(decision) => void decide([transfer.id], decision)}
          />
        ))}
      </ul>
    </div>
  )
}
