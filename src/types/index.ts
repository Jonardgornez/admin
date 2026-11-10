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
  // Null when the PC has not reported a version. Null clientUpdate means no update is queued.
  clientVersion?: string | null
  clientUpdate?: ClientUpdateStatus | null
}

export const CLIENT_UPDATE_STATES = ['pending', 'downloading', 'installing', 'failed'] as const

export type ClientUpdateState = (typeof CLIENT_UPDATE_STATES)[number]

// An update queued for one PC. The PC reports its progress, and the server sends the error text when it fails.
export interface ClientUpdateStatus {
  targetVersion: string
  state: ClientUpdateState
  error: string | null
}

// The installer the admin uploaded. The server keeps only one.
export interface ClientRelease {
  version: string
  sha256: string
  sizeBytes: number
  uploadedAtUtc: string
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
  clientVersion: string | null
  clientUpdate: ClientUpdateStatus | null
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

export const SESSION_LOG_SOURCES = ['account', 'admin-unlock', 'login-request'] as const

export type SessionLogSource = (typeof SESSION_LOG_SOURCES)[number]

// Why a session ended. 'unknown' stands in for any reason this console does not know.
export const SESSION_LOG_END_REASONS = [
  'logout',
  'time-expired',
  'account-disabled',
  'account-deleted',
  'replaced',
  'pc-removed',
  'connection-lost',
  'shutdown',
  'reboot',
  'unknown',
] as const

export type SessionLogEndReason = (typeof SESSION_LOG_END_REASONS)[number]

export interface SessionLog {
  id: number
  pcName: string
  userOrSource: string
  source: SessionLogSource
  startedAt: string
  // Null while the session is still running.
  endedAt: string | null
  durationMinutes: number
  endReason: SessionLogEndReason | null
}

export interface SessionLogPage {
  items: SessionLog[]
  totalItems: number
  page: number
  pageSize: number
}

export type ApprovalChoice = { mode: 'time-limit'; minutes: number } | { mode: 'open-time' }

// The power commands that take a PC offline or back on. Shutdown and reboot share one flow.
export type PowerCommand = 'shutdown' | 'reboot'

export type PendingPcAction =
  | { kind: PowerCommand; pcName: string }
  | { kind: `${PowerCommand}-selected`; pcNames: string[] }
