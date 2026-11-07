import type { Pc, ViewMode } from '../types'
import { isPcActionable } from './pcs'
import type { ControlOffReason, ServerControlMessage } from './remote-input'
import type { ScreenStreamStatus } from './screen-stream'

// Local-only reasons (never sent on the wire) are added to the server's off reasons.
export type RemoteControlEndReason = ControlOffReason | 'paused'

export type RemoteControlState =
  | { kind: 'off'; reason: RemoteControlEndReason | null }
  | { kind: 'requesting' }
  | { kind: 'on' }

export const CONTROL_OFF_STATE: RemoteControlState = { kind: 'off', reason: null }

export const REQUIRED_CLIENT_VERSION = '0.10.0'
const SERVER_PC_MESSAGE = "You can't control the server's own PC."
const LIVE_PICTURE_MESSAGE = 'Wait for the live picture before taking control.'

const CONTROL_END_MESSAGES: Record<RemoteControlEndReason, string | null> = {
  stopped: null,
  anonymous: 'Remote control needs Notified view.',
  'server-pc': SERVER_PC_MESSAGE,
  waiting: LIVE_PICTURE_MESSAGE,
  unsupported: `This PC's client is too old for remote control. Update it to ${REQUIRED_CLIENT_VERSION}.`,
  connection: 'The connection to the PC dropped, so control stopped.',
  'pc-ended': 'The PC ended remote control.',
  paused: "The PC's screen paused (for example a UAC prompt), so control stopped.",
}

export function startControl(state: RemoteControlState): RemoteControlState {
  return state.kind === 'off' ? { kind: 'requesting' } : state
}

export function endControl(
  state: RemoteControlState,
  reason: RemoteControlEndReason,
): RemoteControlState {
  return state.kind === 'off' ? state : { kind: 'off', reason }
}

// The PC never confirmed in time, so the request ends as unsupported. A request that already
// turned on is left alone.
export function timeOutControlRequest(state: RemoteControlState): RemoteControlState {
  return state.kind === 'requesting' ? { kind: 'off', reason: 'unsupported' } : state
}

// Server messages only move a request or a session forward. An off message while already off
// changes nothing, so a late reply never overrides a newer state.
export function applyServerControlMessage(
  state: RemoteControlState,
  message: ServerControlMessage,
): RemoteControlState {
  switch (message.control) {
    case 'requesting':
      return state
    case 'on':
      return state.kind === 'requesting' ? { kind: 'on' } : state
    case 'off':
      return endControl(state, message.reason)
  }
}

export function getControlEndMessage(state: RemoteControlState): string | null {
  return state.kind === 'off' && state.reason !== null ? CONTROL_END_MESSAGES[state.reason] : null
}

// The first unmet requirement, in the order the admin can fix them. Null means Take control is allowed.
export function getTakeControlBlockMessage(
  pc: Pc,
  viewMode: ViewMode,
  streamStatus: ScreenStreamStatus,
): string | null {
  if (viewMode === 'anonymous') return 'Switch to Notified view to take control.'
  if (pc.isServerPc) return SERVER_PC_MESSAGE
  if (!isPcActionable(pc)) return 'Remote control is unavailable while this PC is off or rebooting.'
  if (streamStatus.kind !== 'live') return LIVE_PICTURE_MESSAGE
  return null
}
