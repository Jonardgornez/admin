import type { IconName } from '../component/ui/icon'
import type { ApiResult } from './api'
import { isSessionExpired } from './auth-state'
import type { RegistrationRequest } from './registration-requests-api'

export type RegistrationAction = 'accept' | 'deny'

export interface AnswerNotice {
  message: string
  icon: IconName
}

const NOT_FOUND_STATUS = 404

export const ALREADY_ANSWERED_MESSAGE = 'That request was already answered or has expired.'

export function formatPairingNumber(pairingNumber: string): string {
  return pairingNumber.replace(/^(\d{3})(\d{3})$/, '$1 $2')
}

export function getWaitingLabel(waitingCount: number): string | null {
  return waitingCount > 1 ? `1 of ${waitingCount} waiting` : null
}

export function removeRegistrationRequest(
  requests: RegistrationRequest[],
  id: number,
): RegistrationRequest[] {
  return requests.filter((request) => request.id !== id)
}

// The server answers 404 when the request was already decided or has expired.
export function isAlreadyAnswered(result: ApiResult<unknown>): boolean {
  return !result.success && result.status === NOT_FOUND_STATUS
}

// Null means the session ended, and the sign-out redirect already explains that.
export function describeAnswer(
  action: RegistrationAction,
  pcName: string,
  result: ApiResult<unknown>,
): AnswerNotice | null {
  if (result.success) {
    return action === 'accept'
      ? { message: `${pcName} connected.`, icon: 'check' }
      : { message: `${pcName} denied.`, icon: 'x' }
  }
  if (isSessionExpired(result)) return null
  if (isAlreadyAnswered(result)) return { message: ALREADY_ANSWERED_MESSAGE, icon: 'alert' }
  return { message: result.error, icon: 'alert' }
}
