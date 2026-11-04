import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Icon, type IconName } from './icon'

const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1.5 rounded-full border border-current px-2 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        locked: 'bg-st-locked-bg text-st-locked',
        'in-use': 'bg-st-inuse-bg text-st-inuse',
        offline: 'bg-st-offline-bg text-st-offline',
        shutdown: 'bg-st-shutdown-bg text-st-shutdown',
        rebooting: 'bg-st-reboot-bg text-st-reboot',
        'open-time': 'bg-st-open-bg text-st-open',
      },
    },
    defaultVariants: {
      variant: 'offline',
    },
  },
)

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: IconName
}

export function Badge({ className, variant, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  )
}
