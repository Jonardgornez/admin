// 'locked' is online with no user; 'frozen' is online and locked by the admin.
export type PcStatus = 'locked' | 'frozen' | 'in-use' | 'offline' | 'shutdown' | 'rebooting'

export type ViewMode = 'notified' | 'anonymous'

export interface Pc {
  name: string
  status: PcStatus
  isLocked?: boolean
  isShuttingDown?: boolean
  isRestarting?: boolean
  isCancelling?: boolean
  isServerPc?: boolean
  user?: string
  timeUsed?: string
  lastSeen: string
  ipAddress?: string
  isOpenTime?: boolean
  minutesLeft?: number
  restrictions?: PcRestrictions
  internetBlocked?: boolean
  // Null when the PC has not reported, e.g. a client older than 0.16.0.
  internetBlockApplied?: boolean | null
}

export interface ServerPcSession {
  // Null for a session the admin unlocked, where nobody signed in.
  username: string | null
  startedAt: string
  time: ApprovalChoice
  secondsRemaining: number | null
}

export type ServerPcShutdownState =
  | 'shutting-down'
  | 'shutdown'
  | 'restarting'
  | 'rebooting'
  | 'cancelling'

export interface ServerPc {
  id: number
  name: string
  isOnline: boolean
  isLocked: boolean
  ipAddress: string | null
  registeredAt: string
  lastSeenAt: string
  session: ServerPcSession | null
  shutdownState: ServerPcShutdownState | null
  isServerPc: boolean
  internetBlocked: boolean
  internetBlockApplied: boolean | null
}

export interface RegisteredPc extends Pc {
  id: number
}

export type RestrictionPolicyId =
  | 'task-manager'
  | 'registry-editor'
  | 'command-prompt'
  | 'run-command'
  | 'control-panel'
  | 'add-printer'
  | 'remove-printer'
  | 'windows-logout'
  | 'fast-user-switch'
  | 'windows-shutdown'
  | 'file-folder-protection'

export type DriveLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'

export interface RestrictionPolicy {
  id: RestrictionPolicyId
  label: string
  needsReboot: boolean
}

export interface PcRestrictions {
  policies: RestrictionPolicyId[]
  hiddenDrives: DriveLetter[]
  disabledDrives: DriveLetter[]
}

export type TimeUnit = 'minutes' | 'hours'

export type SelectionState = 'all' | 'some' | 'none'

export type PcLockAction = 'lock' | 'unlock'

// The body of POST /api/pcs/{id}/time.
export type PcTimeCommand =
  | { action: 'add-time'; minutes: number }
  | { action: 'open-time' }
  | { action: 'time-out' }

export type BulkLockKind = PcLockAction

// The internet block is set on PCs in bulk or one at a time from the detail dialog.
export interface InternetAction {
  blocked: boolean
  pcIds: number[]
}

export interface Account {
  id: number
  username: string
  isActive: boolean
  defaultTime: ApprovalChoice
  lastLoginAt: string | null
}

export interface TimeChoiceValues {
  timeMode: ApprovalChoice['mode']
  timeAmount: string
  timeUnit: TimeUnit
}

export type LoginRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

// Why a request was denied or cancelled. The server may send other strings, which are ignored.
export const LOGIN_REQUEST_REASONS = [
  'pc-offline',
  'pc-locked',
  'pc-in-use',
  'pc-removed',
  'pc-unknown',
  'logged-in',
  'cancelled-by-pc',
  'expired',
] as const

export type LoginRequestReason = (typeof LOGIN_REQUEST_REASONS)[number]

export interface LoginRequest {
  id: number
  pcName: string
  requestedAt: string
  status: LoginRequestStatus
  time?: ApprovalChoice
  decidedAt: string | null
  reason?: LoginRequestReason
}

export interface SessionLog {
  id: string
  pcName: string
  userOrSource: string
  startedAt: string
  endedAt: string | null
  durationMinutes: number
  endedBy: string | null
}

export type ApprovalChoice = { mode: 'time-limit'; minutes: number } | { mode: 'open-time' }

// The power commands that take a PC offline or back on. Shutdown and reboot share one flow.
export type PowerCommand = 'shutdown' | 'reboot'

export type PendingPcAction =
  | { kind: PowerCommand; pcName: string }
  | { kind: `${PowerCommand}-selected`; pcNames: string[] }
