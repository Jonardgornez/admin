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
}

export type TimeUnit = 'minutes' | 'hours'

export type SelectionState = 'all' | 'some' | 'none'

export interface Account {
  username: string
  assignedPc: string
  canUseAnyPc: boolean
  isActive: boolean
  lastLogin: string
}

export type AccountDetails = Pick<Account, 'username' | 'assignedPc' | 'canUseAnyPc'>

export interface AccountFormValues extends AccountDetails {
  password: string
}

export type AccountFormErrors = Partial<Record<'username' | 'assignedPc' | 'password', string>>

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
