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
  // The wallpaper set on the PC, or null for none. Students cannot change it while it is set.
  wallpaperId?: number | null
  // True keeps the PC from sleeping and its screen on.
  keepAwake?: boolean
  // Null when the Lykantra service has not reported, e.g. a server older than the diagnostics feature.
  service?: PcServiceStatus | null
}

// The Lykantra service on a PC. It keeps reporting even when the client app is not running.
export interface PcServiceStatus {
  lastSeenAt: string
  clientRunning: boolean
}

export const CLIENT_UPDATE_STATES = ['pending', 'downloading', 'installing', 'failed'] as const

export type ClientUpdateState = (typeof CLIENT_UPDATE_STATES)[number]

// An update queued for one PC. The PC reports its progress, and the server sends the error text when it fails.
export interface ClientUpdateStatus {
  targetVersion: string
  state: ClientUpdateState
  error: string | null
  // True when the admin chose to sign the student out after a warning instead of waiting for idle.
  installNow: boolean
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
  wallpaper: ServerPcWallpaper | null
  service: PcServiceStatus | null
  keepAwake: boolean
}

export interface ServerPcWallpaper {
  id: number
  sha256: string
}

export const DIAGNOSTICS_UPDATE_STATES = [
  'pending',
  'waiting',
  'downloading',
  'installing',
  'failed',
] as const

export type DiagnosticsUpdateState = (typeof DIAGNOSTICS_UPDATE_STATES)[number]

export const DIAGNOSTICS_EVENT_LEVELS = ['information', 'warning', 'error'] as const

export type DiagnosticsEventLevel = (typeof DIAGNOSTICS_EVENT_LEVELS)[number]

export interface DiagnosticsUpdate {
  version: string
  state: DiagnosticsUpdateState
  error: string | null
}

export interface DiagnosticsEvent {
  at: string
  level: DiagnosticsEventLevel
  message: string
}

// The latest health report a PC's Lykantra service sent to the server.
export interface PcDiagnostics {
  receivedAt: string
  serviceVersion: string
  clientRunning: boolean
  clientVersion: string | null
  userSignedIn: boolean
  update: DiagnosticsUpdate | null
  events: DiagnosticsEvent[]
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

// Setting a wallpaper and removing one share the same result message.
export type WallpaperCommand = 'set' | 'remove'

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

// The known folders on a PC that a shared file can be saved under.
export const SHARE_FOLDERS = ['desktop', 'documents', 'downloads'] as const

export type ShareFolder = (typeof SHARE_FOLDERS)[number]

// waiting, downloading, exists and applying can still change. The rest are final.
export const FILE_TRANSFER_STATUSES = [
  'waiting',
  'downloading',
  'exists',
  'applying',
  'saved',
  'skipped',
  'failed',
  'expired',
  'cancelled',
] as const

export type FileTransferStatus = (typeof FILE_TRANSFER_STATUSES)[number]

// What a PC does when the file is already in the folder.
export const FILE_TRANSFER_DECISIONS = ['overwrite', 'keepBoth', 'skip'] as const

export type FileTransferDecision = (typeof FILE_TRANSFER_DECISIONS)[number]

// Why a waiting transfer has not been handed to its PC yet.
export const FILE_TRANSFER_WAITING_REASONS = ['offline', 'busy', 'clientTooOld'] as const

export type FileTransferWaitingReason = (typeof FILE_TRANSFER_WAITING_REASONS)[number]

// A file the admin uploaded once, to be sent to any number of PCs.
export interface SharedFile {
  id: number
  name: string
  sizeBytes: number
  sha256: string
}

// One PC's copy of a shared file. savedAs is set once saved, error once failed.
// waitingReason is set only while waiting. busyWith names the file the PC is still receiving when busy.
// bytesSent is set only while downloading or applying, and never goes above sizeBytes.
export interface FileTransfer {
  id: number
  pcId: number
  pcName: string
  fileName: string
  sizeBytes: number
  folder: ShareFolder
  subfolder: string
  status: FileTransferStatus
  decision: FileTransferDecision | null
  savedAs: string | null
  error: string | null
  waitingReason: FileTransferWaitingReason | null
  busyWith: string | null
  bytesSent: number | null
  pcClientVersion: string | null
  createdUtc: string
  updatedUtc: string
}
