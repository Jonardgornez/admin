import { getInternetStatus, getInternetStatusLabel, type InternetStatus } from '../../lib/internet'
import { isPcUnlockedWithoutUser } from '../../lib/pcs'
import type { Pc, PcStatus } from '../../types'
import { Badge, type BadgeVariant } from '../ui/badge'
import type { IconName } from '../ui/icon'

interface StatusDisplay {
  label: string
  icon: IconName
}

const STATUS_DISPLAY: Record<PcStatus, StatusDisplay> = {
  locked: { label: 'Online – No user', icon: 'monitor' },
  frozen: { label: 'Online – Locked', icon: 'lock' },
  'in-use': { label: 'Online – In Use', icon: 'user' },
  offline: { label: 'Offline', icon: 'plug' },
  shutdown: { label: 'Shutdown', icon: 'power' },
  rebooting: { label: 'Rebooting', icon: 'refresh' },
}

const UNLOCKED_DISPLAY: StatusDisplay = { label: 'Online – Unlocked', icon: 'unlock' }

interface PcStatusBadgeProps {
  pc: Pick<Pc, 'status' | 'user' | 'isShuttingDown' | 'isRestarting' | 'isCancelling'>
}

export function PcStatusBadge({ pc }: PcStatusBadgeProps) {
  if (pc.isShuttingDown) {
    return (
      <Badge variant="shutdown" icon="power">
        Shutting down
      </Badge>
    )
  }
  if (pc.isRestarting) {
    return (
      <Badge variant="rebooting" icon="refresh">
        Restarting
      </Badge>
    )
  }
  if (pc.isCancelling) {
    return (
      <Badge variant="rebooting" icon="x">
        Cancelling
      </Badge>
    )
  }
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

export function WallpaperBadge() {
  return (
    <Badge variant="wallpaper" icon="image">
      Wallpaper set
    </Badge>
  )
}

export function KeepAwakeBadge() {
  return (
    <Badge variant="keep-awake" icon="eye">
      Always awake
    </Badge>
  )
}

// The card badge only flags an internet block that is set or still being applied.
interface InternetBadgeDisplay {
  variant: BadgeVariant
  icon: IconName
}

const INTERNET_BADGES: Partial<Record<InternetStatus, InternetBadgeDisplay>> = {
  off: { variant: 'no-internet', icon: 'plug' },
  'turning-off': { variant: 'internet-changing', icon: 'plug' },
  'turning-on': { variant: 'internet-changing', icon: 'plug' },
}

interface InternetBadgeProps {
  pc: Pc
}

export function InternetBadge({ pc }: InternetBadgeProps) {
  const status = getInternetStatus(pc)
  const display = INTERNET_BADGES[status]
  if (!display) return null
  return (
    <Badge variant={display.variant} icon={display.icon}>
      {getInternetStatusLabel(status)}
    </Badge>
  )
}
