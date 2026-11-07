import { describe, expect, it } from 'vitest'
import type { Pc } from '../types'
import {
  applyServerControlMessage,
  CONTROL_OFF_STATE,
  endControl,
  getControlEndMessage,
  getTakeControlBlockMessage,
  startControl,
  type RemoteControlState,
} from './remote-control'
import type { ServerControlMessage } from './remote-input'

const ON: RemoteControlState = { kind: 'on' }
const REQUESTING: RemoteControlState = { kind: 'requesting' }
const LIVE = { kind: 'live' } as const

function pcWith(overrides: Partial<Pc> = {}): Pc {
  return { name: 'PC-01', status: 'locked', lastSeen: '2026-11-07T10:00:00Z', ...overrides }
}

describe('startControl', () => {
  it('moves from off to requesting', () => {
    expect(startControl(CONTROL_OFF_STATE)).toEqual({ kind: 'requesting' })
  })

  it('leaves an active session unchanged', () => {
    expect(startControl(ON)).toBe(ON)
    expect(startControl(REQUESTING)).toBe(REQUESTING)
  })
})

describe('applyServerControlMessage', () => {
  const requesting: ServerControlMessage = { control: 'requesting' }
  const on: ServerControlMessage = { control: 'on' }
  const off = (reason: Extract<ServerControlMessage, { control: 'off' }>['reason']): ServerControlMessage => ({
    control: 'off',
    reason,
  })

  it('keeps requesting while the PC is asked', () => {
    expect(applyServerControlMessage(REQUESTING, requesting)).toBe(REQUESTING)
  })

  it('turns requesting into on when the PC confirms', () => {
    expect(applyServerControlMessage(REQUESTING, on)).toEqual({ kind: 'on' })
  })

  it('ends a request with the server reason', () => {
    expect(applyServerControlMessage(REQUESTING, off('anonymous'))).toEqual({
      kind: 'off',
      reason: 'anonymous',
    })
  })

  it('ends an active session with the server reason', () => {
    expect(applyServerControlMessage(ON, off('pc-ended'))).toEqual({
      kind: 'off',
      reason: 'pc-ended',
    })
  })

  it('ignores messages that do not match the current state', () => {
    expect(applyServerControlMessage(CONTROL_OFF_STATE, on)).toBe(CONTROL_OFF_STATE)
    expect(applyServerControlMessage(CONTROL_OFF_STATE, requesting)).toBe(CONTROL_OFF_STATE)
    expect(applyServerControlMessage(CONTROL_OFF_STATE, off('stopped'))).toBe(CONTROL_OFF_STATE)
  })
})

describe('endControl', () => {
  it('ends an active session with a reason', () => {
    expect(endControl(ON, 'connection')).toEqual({ kind: 'off', reason: 'connection' })
    expect(endControl(REQUESTING, 'stopped')).toEqual({ kind: 'off', reason: 'stopped' })
  })

  it('leaves an off state unchanged', () => {
    expect(endControl(CONTROL_OFF_STATE, 'connection')).toBe(CONTROL_OFF_STATE)
  })
})

describe('getControlEndMessage', () => {
  it('explains each refusal and end reason', () => {
    expect(getControlEndMessage({ kind: 'off', reason: 'anonymous' })).toBe(
      'Remote control needs Notified view.',
    )
    expect(getControlEndMessage({ kind: 'off', reason: 'server-pc' })).toBe(
      "You can't control the server's own PC.",
    )
    expect(getControlEndMessage({ kind: 'off', reason: 'waiting' })).toBe(
      'Wait for the live picture before taking control.',
    )
    expect(getControlEndMessage({ kind: 'off', reason: 'unsupported' })).toBe(
      "This PC's client is too old for remote control. Update it to 0.10.0.",
    )
    expect(getControlEndMessage({ kind: 'off', reason: 'connection' })).toBe(
      'The connection to the PC dropped, so control stopped.',
    )
    expect(getControlEndMessage({ kind: 'off', reason: 'pc-ended' })).toBe(
      'The PC ended remote control.',
    )
  })

  it('shows no error for a stop the admin asked for', () => {
    expect(getControlEndMessage({ kind: 'off', reason: 'stopped' })).toBeNull()
  })

  it('shows no error when control was never refused or ended', () => {
    expect(getControlEndMessage(CONTROL_OFF_STATE)).toBeNull()
    expect(getControlEndMessage(ON)).toBeNull()
  })
})

describe('getTakeControlBlockMessage', () => {
  it('allows Take control for a notified, live, actionable PC', () => {
    expect(getTakeControlBlockMessage(pcWith(), 'notified', LIVE)).toBeNull()
  })

  it('asks for Notified view in the anonymous view', () => {
    expect(getTakeControlBlockMessage(pcWith(), 'anonymous', LIVE)).toBe(
      'Switch to Notified view to take control.',
    )
  })

  it("refuses the server's own PC", () => {
    expect(getTakeControlBlockMessage(pcWith({ isServerPc: true }), 'notified', LIVE)).toBe(
      "You can't control the server's own PC.",
    )
  })

  it('refuses a PC that is off or rebooting', () => {
    expect(getTakeControlBlockMessage(pcWith({ status: 'offline' }), 'notified', LIVE)).toBe(
      'Remote control is unavailable while this PC is off or rebooting.',
    )
    expect(getTakeControlBlockMessage(pcWith({ status: 'rebooting' }), 'notified', LIVE)).toBe(
      'Remote control is unavailable while this PC is off or rebooting.',
    )
  })

  it('waits for the live picture', () => {
    expect(getTakeControlBlockMessage(pcWith(), 'notified', { kind: 'waiting' })).toBe(
      'Wait for the live picture before taking control.',
    )
  })

  it('checks the view before the PC state', () => {
    expect(
      getTakeControlBlockMessage(pcWith({ isServerPc: true }), 'anonymous', LIVE),
    ).toBe('Switch to Notified view to take control.')
  })
})
