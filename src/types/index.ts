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
  username: string
  isActive: boolean
  lastLogin: string
  defaultTime: ApprovalChoice
}

export type AccountDetails = Pick<Account, 'username' | 'defaultTime'>

export interface AccountFormValues extends Pick<Account, 'username'> {
  password: string
  timeMode: ApprovalChoice['mode']
  timeAmount: string
  timeUnit: TimeUnit
}

export type AccountFormErrors = Partial<Record<'username' | 'password' | 'defaultTime', string>>

export interface LoginRequest {
  id: string
  pcName: string
  requestedAt: string
  requestedAgo: string
}

export type RequestDecision = 'Approved' | 'Denied'

export interface RequestHistoryEntry {
  id: string
  pcName: string
  requestedAt: string
  decision: RequestDecision
  session: string
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
