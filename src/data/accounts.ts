import type { Account } from '../types'

export const accounts: Account[] = [
  { username: 'lab-pc01', assignedPc: 'PC-01', canUseAnyPc: false, isActive: true, lastLogin: 'Today 09:58' },
  { username: 'lab-pc02', assignedPc: 'PC-02', canUseAnyPc: false, isActive: true, lastLogin: 'Yesterday 15:20' },
  { username: 'lab-pc03', assignedPc: 'PC-03', canUseAnyPc: false, isActive: true, lastLogin: 'Today 10:04' },
  { username: 'lab-pc04', assignedPc: 'PC-04', canUseAnyPc: false, isActive: false, lastLogin: '28 Oct 14:10' },
  { username: 'lab-pc05', assignedPc: 'PC-05', canUseAnyPc: true, isActive: true, lastLogin: 'Today 09:30' },
  { username: 'lab-pc06', assignedPc: 'PC-06', canUseAnyPc: false, isActive: true, lastLogin: 'Yesterday 13:02' },
  { username: 'lab-pc07', assignedPc: 'PC-07', canUseAnyPc: false, isActive: true, lastLogin: 'Today 08:45' },
  { username: 'lab-pc08', assignedPc: 'PC-08', canUseAnyPc: false, isActive: true, lastLogin: 'Never' },
]
