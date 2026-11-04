import type { PcStatus } from '../../types'
import { Badge } from '../ui/badge'
import type { IconName } from '../ui/icon'

const STATUS_DISPLAY: Record<PcStatus, { label: string; icon: IconName }> = {
  locked: { label: 'Online – Locked', icon: 'lock' },
  'in-use': { label: 'Online – In Use', icon: 'user' },
  offline: { label: 'Offline', icon: 'plug' },
  shutdown: { label: 'Shutdown', icon: 'power' },
  rebooting: { label: 'Rebooting', icon: 'refresh' },
}

interface PcStatusBadgeProps {
  status: PcStatus
}

export function PcStatusBadge({ status }: PcStatusBadgeProps) {
  const { label, icon } = STATUS_DISPLAY[status]
  return (
    <Badge variant={status} icon={icon}>
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
