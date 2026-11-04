export type PcStatus = 'locked' | 'in-use' | 'offline' | 'shutdown' | 'rebooting'

export interface Pc {
  name: string
  status: PcStatus
  user?: string
  timeUsed?: string
  lastSeen: string
  ipAddress?: string
  isOpenTime?: boolean
}

export interface Account {
  username: string
  assignedPc: string
  canUseAnyPc: boolean
  isActive: boolean
  lastLogin: string
}

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
