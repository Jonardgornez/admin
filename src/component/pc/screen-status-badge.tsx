import type { ComponentProps } from 'react'
import { getScreenStatusLabel, type ScreenStreamStatus } from '../../lib/screen-stream'
import { Badge } from '../ui/badge'
import type { IconName } from '../ui/icon'

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

interface StatusDisplay {
  variant: BadgeVariant
  icon: IconName
}

const STATUS_DISPLAY: Record<ScreenStreamStatus['kind'], StatusDisplay> = {
  idle: { variant: 'offline', icon: 'refresh' },
  connecting: { variant: 'offline', icon: 'refresh' },
  waiting: { variant: 'locked', icon: 'clock' },
  live: { variant: 'in-use', icon: 'eye' },
  paused: { variant: 'rebooting', icon: 'shield' },
  ended: { variant: 'shutdown', icon: 'alert' },
}

interface ScreenStatusBadgeProps {
  status: ScreenStreamStatus
}

// The label is always shown as text, so the status never relies on color alone.
export function ScreenStatusBadge({ status }: ScreenStatusBadgeProps) {
  const { variant, icon } = STATUS_DISPLAY[status.kind]
  return (
    <Badge variant={variant} icon={icon}>
      {getScreenStatusLabel(status)}
    </Badge>
  )
}
