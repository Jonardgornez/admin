import { describe, expect, it } from 'vitest'
import type { InternetResult } from './internet-api'
import {
  CLIENT_UPDATE_HINT,
  describeInternetResult,
  getInternetHint,
  getInternetStatus,
  getInternetStatusLabel,
  getInternetChoice,
  getPcIdsToSetInternet,
} from './internet'
import type { Pc, RegisteredPc } from '../types'

const onlinePc: Pc = { name: 'PC-01', status: 'locked', lastSeen: 'Now' }
const offlinePc: Pc = { name: 'PC-02', status: 'offline', lastSeen: '09:15' }

function registeredPc(id: number, overrides: Partial<RegisteredPc> = {}): RegisteredPc {
  return { ...onlinePc, id, name: `PC-${id}`, ...overrides }
}

const pcs: RegisteredPc[] = [
  registeredPc(1),
  registeredPc(2, { internetBlocked: true, internetBlockApplied: true }),
  registeredPc(3, { isServerPc: true }),
  registeredPc(4, { internetBlocked: false, internetBlockApplied: null }),
  registeredPc(5),
]

function result(pcId: number, status: InternetResult['result']): InternetResult {
  return { pcId, pcName: `PC-${pcId}`, result: status }
}

describe('getInternetChoice', () => {
  it('is blocked when every PC is blocked', () => {
    expect(getInternetChoice([registeredPc(2, { internetBlocked: true }), registeredPc(6, { internetBlocked: true })])).toBe('blocked')
  })

  it('is open when no PC is blocked', () => {
    expect(getInternetChoice([registeredPc(1), registeredPc(4, { internetBlocked: false })])).toBe('open')
  })

  it('is mixed when some PCs are blocked', () => {
    expect(getInternetChoice([registeredPc(1), registeredPc(2, { internetBlocked: true })])).toBe('mixed')
  })

  it('ignores the server PC', () => {
    expect(getInternetChoice([registeredPc(2, { internetBlocked: true }), registeredPc(3, { isServerPc: true })])).toBe('blocked')
  })

  it('is open when there are no PCs', () => {
    expect(getInternetChoice([])).toBe('open')
  })
})

describe('getPcIdsToSetInternet', () => {
  it('picks the PCs that are not blocked yet when blocking', () => {
    expect(getPcIdsToSetInternet(pcs, true)).toEqual([1, 4, 5])
  })

  it('picks the PCs that are blocked when turning internet back on', () => {
    expect(getPcIdsToSetInternet(pcs, false)).toEqual([2])
  })

  it('skips the server PC in both directions', () => {
    expect(getPcIdsToSetInternet(pcs, true)).not.toContain(3)
    expect(getPcIdsToSetInternet(pcs, false)).not.toContain(3)
  })

  it('keeps offline PCs, since the change applies once they are back', () => {
    const offline = registeredPc(6, { ...offlinePc, name: 'PC-6' })
    expect(getPcIdsToSetInternet([offline], true)).toEqual([6])
  })

  it('returns no PCs when every PC already has the wanted state', () => {
    expect(getPcIdsToSetInternet([registeredPc(2, { internetBlocked: true })], true)).toEqual([])
  })
})

describe('getInternetStatus', () => {
  it('is on for a PC with no block', () => {
    expect(getInternetStatus({ ...onlinePc, internetBlocked: false, internetBlockApplied: null })).toBe(
      'on',
    )
  })

  it('is on for a PC with no block fields from an older server', () => {
    expect(getInternetStatus(onlinePc)).toBe('on')
  })

  it('is on when a block was never applied and the PC is unblocked', () => {
    expect(getInternetStatus({ ...onlinePc, internetBlocked: false, internetBlockApplied: false })).toBe(
      'on',
    )
  })

  it('is turning on while an unblock is still applied on the PC', () => {
    expect(getInternetStatus({ ...onlinePc, internetBlocked: false, internetBlockApplied: true })).toBe(
      'turning-on',
    )
  })

  it('is off once the PC confirms the block', () => {
    expect(getInternetStatus({ ...onlinePc, internetBlocked: true, internetBlockApplied: true })).toBe(
      'off',
    )
  })

  it('is turning off while an online PC has not confirmed the block', () => {
    expect(getInternetStatus({ ...onlinePc, internetBlocked: true, internetBlockApplied: null })).toBe(
      'turning-off',
    )
    expect(getInternetStatus({ ...onlinePc, internetBlocked: true, internetBlockApplied: false })).toBe(
      'turning-off',
    )
  })

  it('is off when online for an offline PC that has not confirmed the block', () => {
    expect(getInternetStatus({ ...offlinePc, internetBlocked: true, internetBlockApplied: null })).toBe(
      'off-when-online',
    )
  })
})

describe('getInternetStatusLabel', () => {
  it.each([
    ['on', 'Internet on'],
    ['off', 'No internet'],
    ['turning-on', 'Turning internet on…'],
    ['turning-off', 'Turning internet off…'],
    ['off-when-online', 'Internet off when online'],
  ] as const)('labels %s as %s', (status, label) => {
    expect(getInternetStatusLabel(status)).toBe(label)
  })
})

describe('getInternetHint', () => {
  it('asks for a newer client when an online blocked PC never reported', () => {
    expect(getInternetHint({ ...onlinePc, internetBlocked: true, internetBlockApplied: null })).toBe(
      CLIENT_UPDATE_HINT,
    )
  })

  it('asks for a newer client when the report field is missing', () => {
    expect(getInternetHint({ ...onlinePc, internetBlocked: true })).toBe(CLIENT_UPDATE_HINT)
  })

  it('has no hint once the PC has reported', () => {
    expect(getInternetHint({ ...onlinePc, internetBlocked: true, internetBlockApplied: true })).toBeUndefined()
    expect(getInternetHint({ ...onlinePc, internetBlocked: true, internetBlockApplied: false })).toBeUndefined()
  })

  it('has no hint for an offline PC', () => {
    expect(getInternetHint({ ...offlinePc, internetBlocked: true, internetBlockApplied: null })).toBeUndefined()
  })

  it('has no hint for a PC that is not blocked', () => {
    expect(getInternetHint({ ...onlinePc, internetBlocked: false, internetBlockApplied: null })).toBeUndefined()
  })
})

describe('describeInternetResult', () => {
  it('says how many PCs are turning off', () => {
    expect(describeInternetResult(true, [result(1, 'ok'), result(4, 'ok')])).toBe(
      'Turning internet off for 2 PCs.',
    )
  })

  it('says how many PCs are turning on', () => {
    expect(describeInternetResult(false, [result(1, 'ok')])).toBe('Turning internet on for 1 PC.')
  })

  it('reports skipped server PCs and PCs not found', () => {
    expect(
      describeInternetResult(true, [
        result(1, 'ok'),
        result(3, 'server-pc'),
        result(7, 'not-found'),
        result(8, 'not-found'),
      ]),
    ).toBe('Turning internet off for 1 PC. Skipped 1 PC that runs the server. 2 PCs not found.')
  })

  it('says when nothing changed', () => {
    expect(describeInternetResult(true, [result(3, 'server-pc')])).toBe(
      'No PCs had their internet changed. Skipped 1 PC that runs the server.',
    )
  })

  it('says when no PCs were sent', () => {
    expect(describeInternetResult(false, [])).toBe('No PCs had their internet changed.')
  })
})
