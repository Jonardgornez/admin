import type { FileTransfer, FileTransferDecision, FileTransferStatus } from '../types'
import { formatSharePath } from './send-file-schema'

// The server takes at most this many PCs in one send.
export const MAX_SEND_FILE_PCS = 200

const PENDING_STATUSES: ReadonlySet<FileTransferStatus> = new Set([
  'waiting',
  'downloading',
  'exists',
  'applying',
])

export const FILE_TRANSFER_STATUS_LABELS: Record<FileTransferStatus, string> = {
  waiting: 'Waiting for PC',
  downloading: 'Downloading',
  exists: 'Already exists',
  applying: 'Applying choice',
  saved: 'Saved',
  skipped: 'Skipped',
  failed: 'Failed',
  expired: 'Expired',
}

export const FILE_TRANSFER_DECISION_LABELS: Record<FileTransferDecision, string> = {
  overwrite: 'Overwrite',
  keepBoth: 'Keep both',
  skip: 'Skip',
}

const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * 1024
const BYTES_PER_GB = BYTES_PER_MB * 1024
const FAILED_WITHOUT_REASON = 'The PC did not say why it failed.'
const EXPIRED_NOTE = 'The PC did not pick up the file within an hour.'

export function isFinalTransferStatus(status: FileTransferStatus): boolean {
  return !PENDING_STATUSES.has(status)
}

export function hasPendingTransfers(transfers: FileTransfer[]): boolean {
  return transfers.some((transfer) => !isFinalTransferStatus(transfer.status))
}

export function getExistingTransfers(transfers: FileTransfer[]): FileTransfer[] {
  return transfers.filter((transfer) => transfer.status === 'exists')
}

// Keeps whichever copy of each transfer changed last, so a slow poll can't undo a newer decision.
export function mergeTransfers(current: FileTransfer[], incoming: FileTransfer[]): FileTransfer[] {
  const incomingById = new Map(incoming.map((transfer) => [transfer.id, transfer]))
  return current.map((transfer) => {
    const update = incomingById.get(transfer.id)
    if (!update) return transfer
    return Date.parse(update.updatedUtc) >= Date.parse(transfer.updatedUtc) ? update : transfer
  })
}

// The line under a PC's status, or null when the badge says enough.
export function describeTransferDetail(transfer: FileTransfer): string | null {
  switch (transfer.status) {
    case 'saved':
      return transfer.savedAs ? `Saved as ${transfer.savedAs}` : null
    case 'exists':
      return `Already exists in ${formatSharePath(transfer.folder, transfer.subfolder)}`
    case 'failed':
      return transfer.error ?? FAILED_WITHOUT_REASON
    case 'expired':
      return EXPIRED_NOTE
    default:
      return null
  }
}

export function describeTransferSummary(transfers: FileTransfer[]): string {
  const savedCount = transfers.filter((transfer) => transfer.status === 'saved').length
  return `Saved on ${savedCount} of ${transfers.length} ${transfers.length === 1 ? 'PC' : 'PCs'}.`
}

export function getSendFileTargetLimitError(pcCount: number): string | undefined {
  if (pcCount <= MAX_SEND_FILE_PCS) return undefined
  return `Choose ${MAX_SEND_FILE_PCS} PCs or fewer.`
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < BYTES_PER_MB) return `${Math.max(1, Math.round(sizeBytes / BYTES_PER_KB))} KB`
  if (sizeBytes < BYTES_PER_GB) return `${(sizeBytes / BYTES_PER_MB).toFixed(1)} MB`
  return `${(sizeBytes / BYTES_PER_GB).toFixed(2)} GB`
}

// Whole percent, never above 100. An unknown total counts as no progress yet.
export function toUploadPercent(loaded: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.floor((loaded / total) * 100))
}
