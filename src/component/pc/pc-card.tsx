import { cva } from 'class-variance-authority'
import pcMonitorImage from '../../assets/pc-monitor.png'
import { getTimeLeftLabel, isPcActionable, isPcOff } from '../../lib/pcs'
import type { Pc } from '../../types'
import { Button, ButtonLink } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Icon, type IconName } from '../ui/icon'
import { OpenTimeBadge, PcStatusBadge } from './pc-status-badge'

const cardVariants = cva('flex flex-col gap-3 rounded-lg border p-4 text-ink', {
  variants: {
    isSelected: {
      true: 'bg-brand-tint outline-2 outline-offset-1 outline-brand',
      false: 'bg-linear-to-br from-card-top to-card',
    },
    isOff: {
      true: 'border-border shadow-card',
      false: 'border-card-glow shadow-card-glow',
    },
  },
  defaultVariants: {
    isSelected: false,
    isOff: false,
  },
})

const monitorVariants = cva(
  'h-auto w-24 [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_100%)]',
  {
    variants: {
      isOff: {
        true: 'opacity-disabled grayscale',
        false: '',
      },
    },
    defaultVariants: {
      isOff: false,
    },
  },
)

const metaValueVariants = cva('m-0 min-w-0 break-words text-right', {
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
  areCommandsDisabled: boolean
  isRemoveDisabled?: boolean
  historyHref: string
  onToggleSelect?: () => void
  onOpenDetail: () => void
  onToggleLock?: () => void
  onViewScreen?: () => void
  onAddTime?: () => void
  onShutdown?: () => void
  onRemove?: () => void
}

interface PcMetaRowProps {
  icon: IconName
  label: string
  value?: string
  isOff: boolean
}

function PcMetaRow({ icon, label, value, isOff }: PcMetaRowProps) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="flex items-center gap-2 text-ink-muted">
        <Icon name={icon} />
        {label}
      </dt>
      <dd className={metaValueVariants({ isOff })}>{value ?? '—'}</dd>
    </div>
  )
}

export function PcCard({
  pc,
  isSelected,
  areCommandsDisabled,
  isRemoveDisabled = false,
  historyHref,
  onToggleSelect,
  onOpenDetail,
  onToggleLock,
  onViewScreen,
  onAddTime,
  onShutdown,
  onRemove,
}: PcCardProps) {
  const isOff = isPcOff(pc)
  const isInUse = pc.status === 'in-use'
  const timeLeftLabel = getTimeLeftLabel(pc)
  const areActionsDisabled = areCommandsDisabled || isOff
  const lockLabel = `${isInUse ? 'Lock' : 'Unlock'} ${pc.name}`
  const viewLabel = `View screen of ${pc.name}`
  const historyLabel = `View history of ${pc.name}`
  const editTimeLabel = `Edit time for ${pc.name}`
  const shutdownLabel = `Shut down ${pc.name}`
  const removeLabel = `Remove ${pc.name}`
  const canRemove = onRemove !== undefined && pc.status === 'offline'

  return (
    <article className={cardVariants({ isSelected, isOff })}>
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Icon name="monitor" size={24} className="text-card-glow" />
            <h3 className="m-0">
              <button
                type="button"
                disabled={!isPcActionable(pc)}
                onClick={onOpenDetail}
                className="cursor-pointer rounded-sm bg-transparent p-0 font-mono text-xl font-semibold text-ink enabled:hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed"
              >
                {pc.name}
              </button>
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <PcStatusBadge pc={pc} />
            {pc.isOpenTime && <OpenTimeBadge />}
          </div>
        </div>
        <div className="flex flex-none items-start gap-2">
          <img
            src={pcMonitorImage}
            alt=""
            width={240}
            height={210}
            loading="lazy"
            className={monitorVariants({ isOff })}
          />
          {!areCommandsDisabled && (
            <Checkbox
              aria-label={`Select ${pc.name}`}
              checked={isSelected}
              onChange={onToggleSelect}
            />
          )}
        </div>
      </header>
      <dl className="m-0 flex flex-col gap-1.5 border-t border-border pt-3">
        <PcMetaRow icon="monitor" label="IP address" value={pc.ipAddress} isOff={isOff} />
        <PcMetaRow icon="clock" label="Last seen" value={pc.lastSeen} isOff={isOff} />
        {pc.user && <PcMetaRow icon="user" label="User" value={pc.user} isOff={isOff} />}
        {pc.timeUsed && (
          <PcMetaRow icon="clock" label="Time used" value={pc.timeUsed} isOff={isOff} />
        )}
        {timeLeftLabel && (
          <PcMetaRow icon="hourglass" label="Time left" value={timeLeftLabel} isOff={isOff} />
        )}
      </dl>
      <footer className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          variant="secondary"
          isIconOnly
          title={lockLabel}
          aria-label={lockLabel}
          disabled={areActionsDisabled || pc.status === 'rebooting'}
          onClick={onToggleLock}
        >
          <Icon name={isInUse ? 'lock' : 'unlock'} />
        </Button>
        <Button
          variant="secondary"
          isIconOnly
          title={viewLabel}
          aria-label={viewLabel}
          disabled={areActionsDisabled}
          onClick={onViewScreen}
        >
          <Icon name="eye" />
        </Button>
        <ButtonLink
          to={historyHref}
          variant="secondary"
          isIconOnly
          title={historyLabel}
          aria-label={historyLabel}
        >
          <Icon name="history" />
        </ButtonLink>
        <Button
          variant="secondary"
          isIconOnly
          title={editTimeLabel}
          aria-label={editTimeLabel}
          disabled={areActionsDisabled || pc.status === 'rebooting'}
          onClick={onAddTime}
        >
          <Icon name="clock" />
        </Button>
        <Button
          variant="danger"
          isIconOnly
          title={shutdownLabel}
          aria-label={shutdownLabel}
          disabled={areActionsDisabled}
          onClick={onShutdown}
        >
          <Icon name="power" />
        </Button>
        {canRemove && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            aria-label={removeLabel}
            disabled={isRemoveDisabled}
            onClick={onRemove}
          >
            <Icon name="x" />
            Remove
          </Button>
        )}
      </footer>
    </article>
  )
}
