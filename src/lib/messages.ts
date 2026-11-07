import type { PcMessageDelivery, PcMessageStatus } from './messages-api'
import { formatPcCount } from './pcs'

const STATUS_LABELS: Record<PcMessageStatus, string> = {
  delivered: 'Delivered',
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
  const deliveredCount = results.filter((result) => result.status === 'delivered').length
  return `Delivered to ${deliveredCount} of ${formatPcCount(results.length)}.`
}

export function describeOfflineExclusion(offlineCount: number): string {
  if (offlineCount === 0) return ''
  if (offlineCount === 1) return "1 offline PC won't get it."
  return `${offlineCount} offline PCs won't get it.`
}
