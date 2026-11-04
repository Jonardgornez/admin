import { isPcUnlockedWithoutUser } from '../../lib/pcs'
import type { Pc, PcStatus } from '../../types'
import { Badge } from '../ui/badge'
import type { IconName } from '../ui/icon'

interface StatusDisplay {
  label: string
  icon: IconName
}

const STATUS_DISPLAY: Record<PcStatus, StatusDisplay> = {
  locked: { label: 'Online – No user', icon: 'monitor' },
  'in-use': { label: 'Online – In Use', icon: 'user' },
  offline: { label: 'Offline', icon: 'plug' },
  shutdown: { label: 'Shutdown', icon: 'power' },
  rebooting: { label: 'Rebooting', icon: 'refresh' },
}

const UNLOCKED_DISPLAY: StatusDisplay = { label: 'Online – Unlocked', icon: 'unlock' }

interface PcStatusBadgeProps {
  pc: Pick<Pc, 'status' | 'user'>
}

export function PcStatusBadge({ pc }: PcStatusBadgeProps) {
  const isUnlocked = isPcUnlockedWithoutUser(pc)
  const { label, icon } = isUnlocked ? UNLOCKED_DISPLAY : STATUS_DISPLAY[pc.status]
  return (
    <Badge variant={isUnlocked ? 'locked' : pc.status} icon={icon}>
      {label}
    </Badge>
  )
}

export function OpenTimeBadge() {
  return (
    <Badge variant="open-time" icon="clock">
      Open time
    </Badge>
  )
}
