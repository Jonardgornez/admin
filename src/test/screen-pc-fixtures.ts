import type { ServerPc } from '../types'

// A PC as the server lists it. Offline PCs report shut down, so their screen can't be viewed.
export function makeServerPc(id: number, name: string, isOnline: boolean): ServerPc {
  return {
    id,
    name,
    isOnline,
    isLocked: false,
    ipAddress: null,
    registeredAt: '2026-11-01T08:00:00.000Z',
    lastSeenAt: '2026-11-10T10:00:00.000Z',
    session: null,
    shutdownState: isOnline ? null : 'shutdown',
    isServerPc: false,
    internetBlocked: false,
    internetBlockApplied: null,
    clientVersion: null,
    clientUpdate: null,
    wallpaper: null,
    service: null,
    keepAwake: false,
    fastUserSwitchingDisabled: false,
    taskManagerDisabled: false,
    restrictions: { policies: [], hiddenDrives: [], disabledDrives: [] },
  }
}
