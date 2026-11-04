import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Icon, type IconName } from './icon'

const bannerVariants = cva(
  'flex items-start gap-3 rounded-md border px-4 py-3 text-ink',
  {
    variants: {
      variant: {
        info: 'border-st-locked bg-st-locked-bg',
        warning: 'border-st-reboot bg-st-reboot-bg',
        danger: 'border-danger bg-danger-bg',
        neutral: 'border-border-strong bg-surface-300',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
)

const bannerIconVariants = cva('mt-px', {
  variants: {
    variant: {
      info: 'text-st-locked',
      warning: 'text-st-reboot',
      danger: 'text-danger',
      neutral: '',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
})

interface BannerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof bannerVariants> {
  icon: IconName
  title?: string
}

export function Banner({ className, variant, icon, title, children, ...props }: BannerProps) {
  return (
    <div className={cn(bannerVariants({ variant }), className)} {...props}>
      <Icon name={icon} size={20} className={bannerIconVariants({ variant })} />
      <div className="min-w-0 flex-1">
        {title && <p className="m-0 text-base font-semibold">{title}</p>}
        <p className={cn('m-0 text-base', title && 'mt-0.5')}>{children}</p>
      </div>
    </div>
  )
}
