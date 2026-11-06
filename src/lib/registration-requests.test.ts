import { describe, expect, it } from 'vitest'
import type { ApiResult } from './api'
import {
  ALREADY_ANSWERED_MESSAGE,
  describeAnswer,
  formatPairingNumber,
  getWaitingLabel,
  isAlreadyAnswered,
  removeRegistrationRequest,
} from './registration-requests'
import type { RegistrationRequest } from './registration-requests-api'

const failure = (status: number, error: string): ApiResult<undefined> => ({
  success: false,
  status,
  error,
})

const requests: RegistrationRequest[] = [
  {
    id: 1,
    name: 'LAB-PC01',
    ipAddress: '192.168.1.11',
    pairingNumber: '111222',
    requestedAt: '2026-11-06T09:00:00.000Z',
  },
  {
    id: 2,
    name: 'LAB-PC02',
    ipAddress: null,
    pairingNumber: '333444',
    requestedAt: '2026-11-06T09:01:00.000Z',
  },
]

describe('formatPairingNumber', () => {
  it('puts a space after the third digit', () => {
    expect(formatPairingNumber('482915')).toBe('482 915')
  })

  it('leaves a value that is not six digits unchanged', () => {
    expect(formatPairingNumber('48291')).toBe('48291')
  })
})

describe('getWaitingLabel', () => {
  it('returns null when only one request is waiting', () => {
    expect(getWaitingLabel(1)).toBeNull()
  })

  it('shows the position among the waiting requests', () => {
    expect(getWaitingLabel(3)).toBe('1 of 3 waiting')
  })
})

describe('removeRegistrationRequest', () => {
  it('drops the request with the given id and keeps the order', () => {
    expect(removeRegistrationRequest(requests, 1)).toEqual([requests[1]])
  })

  it('returns the same entries when the id is not in the list', () => {
    expect(removeRegistrationRequest(requests, 99)).toEqual(requests)
  })
})

describe('isAlreadyAnswered', () => {
  it('is true for a 404 failure', () => {
    expect(isAlreadyAnswered(failure(404, 'Request not found.'))).toBe(true)
  })

  it('is false for a conflict or a success', () => {
    expect(isAlreadyAnswered(failure(409, 'Name already in use.'))).toBe(false)
    expect(isAlreadyAnswered({ success: true, data: undefined })).toBe(false)
  })
})

describe('describeAnswer', () => {
  it('confirms an accepted PC', () => {
    expect(describeAnswer('accept', 'LAB-PC01', { success: true, data: undefined })).toEqual({
      message: 'LAB-PC01 connected.',
      icon: 'check',
    })
  })

  it('confirms a denied PC', () => {
    expect(describeAnswer('deny', 'LAB-PC01', { success: true, data: undefined })).toEqual({
      message: 'LAB-PC01 denied.',
      icon: 'x',
    })
  })

  it('says the request was already answered or expired on a 404', () => {
    expect(describeAnswer('deny', 'LAB-PC01', failure(404, 'Request not found.'))).toEqual({
      message: ALREADY_ANSWERED_MESSAGE,
      icon: 'alert',
    })
  })

  it('shows the server message for a name conflict', () => {
    expect(describeAnswer('accept', 'LAB-PC01', failure(409, 'Name already in use.'))).toEqual({
      message: 'Name already in use.',
      icon: 'alert',
    })
  })

  it('shows the error for another failure', () => {
    expect(describeAnswer('accept', 'LAB-PC01', failure(500, 'Try later.'))).toEqual({
      message: 'Try later.',
      icon: 'alert',
    })
  })

  it('stays silent when the session has ended', () => {
    expect(describeAnswer('accept', 'LAB-PC01', failure(401, 'Sign in again.'))).toBeNull()
  })
})
