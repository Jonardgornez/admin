import type { InternetResult, InternetResultStatus } from './internet-api'
import { formatPcCount, isPcOnline } from './pcs'
import type { Pc, RegisteredPc } from '../types'

// A PC is "on" until an admin blocks it. The status follows what the client has reported back.
export type InternetStatus = 'on' | 'off' | 'turning-on' | 'turning-off' | 'off-when-online'

export const SERVER_PC_INTERNET_NOTE = 'This PC runs the server, so its internet stays on.'
export const CLIENT_UPDATE_HINT =
  'Needs client 0.16.0 or newer to apply this. The PC has not confirmed the change.'

const INTERNET_STATUS_LABELS: Record<InternetStatus, string> = {
  on: 'Internet on',
  off: 'No internet',
  'turning-on': 'Turning internet on…',
  'turning-off': 'Turning internet off…',
  'off-when-online': 'Internet off when online',
}

// Server PCs are skipped, since a PC running the server must keep its connection.
export function getPcIdsToBlockInternet(pcs: RegisteredPc[], selectedNames: string[]): number[] {
  return pcs
    .filter((pc) => selectedNames.includes(pc.name) && !pc.isServerPc && !pc.internetBlocked)
    .map((pc) => pc.id)
}

export function getPcIdsToUnblockInternet(pcs: RegisteredPc[], selectedNames: string[]): number[] {
  return pcs
    .filter((pc) => selectedNames.includes(pc.name) && pc.internetBlocked === true)
    .map((pc) => pc.id)
}

export function getInternetStatus(pc: Pc): InternetStatus {
  const isApplied = pc.internetBlockApplied === true
  if (pc.internetBlocked !== true) return isApplied ? 'turning-on' : 'on'
  if (isApplied) return 'off'
  return isPcOnline(pc) ? 'turning-off' : 'off-when-online'
}

export function getInternetStatusLabel(status: InternetStatus): string {
  return INTERNET_STATUS_LABELS[status]
}

// Shown while a blocked online PC has never reported back, which means its client is too old.
export function getInternetHint(pc: Pc): string | undefined {
  const hasNotReported = typeof pc.internetBlockApplied !== 'boolean'
  return pc.internetBlocked === true && hasNotReported && isPcOnline(pc)
    ? CLIENT_UPDATE_HINT
    : undefined
}

function countByStatus(results: InternetResult[], status: InternetResultStatus): number {
  return results.filter((result) => result.result === status).length
}

export function describeInternetResult(blocked: boolean, results: InternetResult[]): string {
  const okCount = countByStatus(results, 'ok')
  const serverPcCount = countByStatus(results, 'server-pc')
  const notFoundCount = countByStatus(results, 'not-found')
  const messages = [
    okCount === 0
      ? 'No PCs had their internet changed.'
      : `Turning internet ${blocked ? 'off' : 'on'} for ${formatPcCount(okCount)}.`,
  ]
  if (serverPcCount > 0) {
    messages.push(`Skipped ${formatPcCount(serverPcCount)} that runs the server.`)
  }
  if (notFoundCount > 0) messages.push(`${formatPcCount(notFoundCount)} not found.`)
  return messages.join(' ')
}
