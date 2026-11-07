import { MAX_MESSAGE_RECIPIENTS } from './message-schema'
import type { PcMessageDelivery, PcMessageStatus } from './messages-api'
import { formatPcCount } from './pcs'

// "Received" means the PC showed the message. It does not mean the student read it.
const STATUS_LABELS: Record<PcMessageStatus, string> = {
  delivered: 'Received by the PC',
  failed: "Didn't confirm — the PC may need client 0.12.0",
  offline: 'Offline',
  'not-found': 'No longer registered',
  busy: 'Too many messages waiting',
}

export function describeMessageStatus(status: PcMessageStatus): string {
  return STATUS_LABELS[status]
}

export function getUndeliveredResults(results: PcMessageDelivery[]): PcMessageDelivery[] {
  return results.filter((result) => result.status !== 'delivered')
}

export function describeDeliverySummary(results: PcMessageDelivery[]): string {
  const receivedCount = results.filter((result) => result.status === 'delivered').length
  return `Received by ${formatPcCount(receivedCount)}.`
}

export function getRecipientLimitError(recipientCount: number): string | undefined {
  if (recipientCount <= MAX_MESSAGE_RECIPIENTS) return undefined
  return `Select at most ${MAX_MESSAGE_RECIPIENTS} PCs.`
}

export function describeOfflineExclusion(offlineCount: number): string {
  if (offlineCount === 0) return ''
  if (offlineCount === 1) return "1 offline PC won't get it."
  return `${offlineCount} offline PCs won't get it.`
}
