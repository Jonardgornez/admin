import { cva } from 'class-variance-authority'
import { isPcOff } from '../../lib/pcs'
import type { Pc } from '../../types'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Icon } from '../ui/icon'
import { OpenTimeBadge, PcStatusBadge } from './pc-status-badge'

const cardVariants = cva(
  'flex flex-col gap-3 rounded-lg border border-border p-4 text-ink shadow-card',
  {
    variants: {
      isSelected: {
        true: 'bg-brand-tint outline-2 outline-offset-1 outline-brand',
        false: 'bg-surface-200',
      },
    },
    defaultVariants: {
      isSelected: false,
    },
  },
)

const metaValueVariants = cva('m-0', {
  variants: {
    isOff: {
      true: 'font-normal text-ink-subtle',
      false: 'font-semibold text-ink',
    },
  },
  defaultVariants: {
    isOff: false,
  },
})

interface PcCardProps {
  pc: Pc
  isSelected: boolean
  isDisabled: boolean
  onToggleSelect: () => void
  onOpenDetail: () => void
  onToggleLock: () => void
  onViewScreen: () => void
  onShutdown: () => void
}

interface PcMetaRowProps {
  label: string
  value?: string
  isOff: boolean
}

function PcMetaRow({ label, value, isOff }: PcMetaRowProps) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={metaValueVariants({ isOff })}>{value ?? '—'}</dd>
    </div>
  )
}

export function PcCard({
  pc,
  isSelected,
  isDisabled,
  onToggleSelect,
  onOpenDetail,
  onToggleLock,
  onViewScreen,
  onShutdown,
}: PcCardProps) {
  const isOff = isPcOff(pc)
  const isInUse = pc.status === 'in-use'
  const areActionsDisabled = isDisabled || isOff
  const lockLabel = `${isInUse ? 'Lock' : 'Unlock'} ${pc.name}`
  const viewLabel = `View screen of ${pc.name}`
  const shutdownLabel = `Shut down ${pc.name}`

  return (
    <article className={cardVariants({ isSelected })}>
      <header className="flex items-center justify-between">
        <h3 className="m-0">
          <button
            type="button"
            disabled={isDisabled}
            onClick={onOpenDetail}
            className="cursor-pointer rounded-sm bg-transparent p-0 font-mono disabled:cursor-not-allowed text-lg font-semibold text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {pc.name}
          </button>
        </h3>
        <Checkbox
          aria-label={`Select ${pc.name}`}
          checked={isSelected}
          disabled={isDisabled}
          onChange={onToggleSelect}
        />
      </header>
      <div className="flex flex-wrap gap-2">
        <PcStatusBadge status={pc.status} />
        {pc.isOpenTime && <OpenTimeBadge />}
      </div>
      <dl className="m-0 flex flex-col gap-0.5">
        <PcMetaRow label="User" value={pc.user} isOff={isOff} />
        <PcMetaRow label="Time used" value={pc.timeUsed} isOff={isOff} />
        <PcMetaRow label="Last seen" value={pc.lastSeen} isOff={isOff} />
      </dl>
      <footer className="flex gap-1 border-t border-border pt-2">
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          title={lockLabel}
          aria-label={lockLabel}
          disabled={areActionsDisabled || pc.status === 'rebooting'}
          onClick={onToggleLock}
        >
          <Icon name={isInUse ? 'lock' : 'unlock'} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          title={viewLabel}
          aria-label={viewLabel}
          disabled={areActionsDisabled}
          onClick={onViewScreen}
        >
          <Icon name="eye" />
        </Button>
        <Button
          variant="danger"
          size="sm"
          isIconOnly
          title={shutdownLabel}
          aria-label={shutdownLabel}
          disabled={areActionsDisabled}
          onClick={onShutdown}
        >
          <Icon name="power" />
        </Button>
      </footer>
    </article>
  )
}
