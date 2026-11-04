import type { Account } from '../types'

export const accounts: Account[] = [
  {
    username: 'lab-pc01',
    isActive: true,
    lastLogin: 'Today 09:58',
    defaultTime: { mode: 'time-limit', minutes: 60 },
  },
  {
    username: 'lab-pc02',
    isActive: true,
    lastLogin: 'Yesterday 15:20',
    defaultTime: { mode: 'time-limit', minutes: 60 },
  },
  {
    username: 'lab-pc03',
    isActive: true,
    lastLogin: 'Today 10:04',
    defaultTime: { mode: 'time-limit', minutes: 120 },
  },
  {
    username: 'lab-pc04',
    isActive: false,
    lastLogin: '28 Oct 14:10',
    defaultTime: { mode: 'time-limit', minutes: 60 },
  },
  {
    username: 'lab-pc05',
    isActive: true,
    lastLogin: 'Today 09:30',
    defaultTime: { mode: 'open-time' },
  },
  {
    username: 'lab-pc06',
    isActive: true,
    lastLogin: 'Yesterday 13:02',
    defaultTime: { mode: 'time-limit', minutes: 30 },
  },
  {
    username: 'lab-pc07',
    isActive: true,
    lastLogin: 'Today 08:45',
    defaultTime: { mode: 'time-limit', minutes: 90 },
  },
  {
    username: 'lab-pc08',
    isActive: true,
    lastLogin: 'Never',
    defaultTime: { mode: 'time-limit', minutes: 60 },
  },
]
