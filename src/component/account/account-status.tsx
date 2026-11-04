import { cva } from 'class-variance-authority'
import { Icon } from '../ui/icon'

const statusVariants = cva('inline-flex items-center gap-1.5 font-semibold', {
  variants: {
    isActive: {
      true: 'text-st-inuse',
      false: 'text-ink-muted',
    },
  },
})

interface AccountStatusProps {
  isActive: boolean
}

export function AccountStatus({ isActive }: AccountStatusProps) {
  return (
    <span className={statusVariants({ isActive })}>
      <Icon name={isActive ? 'check' : 'x'} size={14} />
      {isActive ? 'Active' : 'Disabled'}
    </span>
  )
}
