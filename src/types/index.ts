export type PcStatus = 'locked' | 'in-use' | 'offline' | 'shutdown' | 'rebooting'

export type ViewMode = 'notified' | 'anonymous'

export interface Pc {
  name: string
  status: PcStatus
  user?: string
  timeUsed?: string
  lastSeen: string
  ipAddress?: string
  isOpenTime?: boolean
  minutesLeft?: number
  restrictions?: PcRestrictions
}

export interface ServerPc {
  id: number
  name: string
  isOnline: boolean
  ipAddress: string | null
  registeredAt: string
  lastSeenAt: string
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

export type LoginRequestStatus = 'pending' | 'approved' | 'denied'

export interface LoginRequest {
  id: number
  pcName: string
  requestedAt: string
  status: LoginRequestStatus
  time?: ApprovalChoice
  decidedAt: string | null
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

export type PendingPcAction =
  | { kind: 'shutdown'; pcName: string }
  | { kind: 'shutdown-selected'; pcNames: string[] }
  | { kind: 'reboot'; pcName: string }
