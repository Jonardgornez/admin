import type { LoginRequest, RequestHistoryEntry } from '../types'

export const loginRequests: LoginRequest[] = [
  { id: 'req-1', pcName: 'PC-11', requestedAt: '10:43', requestedAgo: '1 minute ago' },
  { id: 'req-2', pcName: 'PC-03', requestedAt: '10:41', requestedAgo: '3 minutes ago' },
]

export const requestHistory: RequestHistoryEntry[] = [
  { id: 'hist-1', pcName: 'PC-06', requestedAt: '09:52', decision: 'Approved', session: '60 min, ended 10:52' },
  { id: 'hist-2', pcName: 'PC-10', requestedAt: '09:30', decision: 'Approved', session: 'Open time, running' },
  { id: 'hist-3', pcName: 'PC-02', requestedAt: '08:58', decision: 'Denied', session: '—' },
  { id: 'hist-4', pcName: 'PC-09', requestedAt: '08:15', decision: 'Approved', session: '30 min, ended 08:45' },
]
