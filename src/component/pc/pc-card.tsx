import { cva } from 'class-variance-authority'
import pcMonitorImage from '../../assets/pc-monitor.png'
import {
  canCancelPcPower,
  canEditPcTime,
  canRebootPc,
  canShutDownPc,
  canViewPcScreen,
  getCancelPowerLabel,
  getLockToggleTarget,
  getTimeLeftLabel,
  isPcActionable,
  isPcOff,
  isPcOnline,
  isPowerCancelButtonShown,
  SERVER_PC_REBOOT_TITLE,
  SERVER_PC_SHUT_DOWN_TITLE,
} from '../../lib/pcs'
import type { Pc } from '../../types'
import { formatClientVersion } from '../../lib/client-updates'
import { Badge } from '../ui/badge'
import { Button, ButtonLink } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Icon, type IconName } from '../ui/icon'
import { ClientUpdateStatusBadge } from './client-update-status'
import { InternetBadge, OpenTimeBadge, PcStatusBadge } from './pc-status-badge'

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
  isLockDisabled?: boolean
  isTimeEditDisabled?: boolean
  isRemoveDisabled?: boolean
  isPowerDisabled?: boolean
  historyHref: string
  onToggleSelect?: () => void
  onOpenDetail: () => void
  onToggleLock?: () => void
  onViewScreen?: () => void
  onAddTime?: () => void
  onReboot?: () => void
  onShutdown?: () => void
  onCancelPower?: () => void
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
  isLockDisabled = false,
  isTimeEditDisabled = false,
  isRemoveDisabled = false,
  isPowerDisabled = false,
  historyHref,
  onToggleSelect,
  onOpenDetail,
  onToggleLock,
  onViewScreen,
  onAddTime,
  onReboot,
  onShutdown,
  onCancelPower,
  onRemove,
}: PcCardProps) {
  const isOff = isPcOff(pc)
  const isOfflineLocked = pc.status === 'offline' && pc.isLocked === true
  const timeLeftLabel = getTimeLeftLabel(pc)
  const lockAction = getLockToggleTarget(pc)
  const lockLabel = `${lockAction === 'lock' ? 'Lock' : 'Unlock'} ${pc.name}`
  const viewLabel = `View screen of ${pc.name}`
  const historyLabel = `View history of ${pc.name}`
  const editTimeLabel = `Edit time for ${pc.name}`
  const rebootLabel = `Reboot ${pc.name}`
  const rebootTitle = pc.isServerPc ? SERVER_PC_REBOOT_TITLE : rebootLabel
  const shutdownLabel = `Shut down ${pc.name}`
  const shutdownTitle = pc.isServerPc ? SERVER_PC_SHUT_DOWN_TITLE : shutdownLabel
  const cancelLabel = getCancelPowerLabel(pc)
  const removeLabel = `Remove ${pc.name}`
  const canRemove = onRemove !== undefined && isOff

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
          <p className="m-0 text-xs text-ink-muted">{formatClientVersion(pc.clientVersion)}</p>
          <div className="flex flex-wrap gap-2">
            <PcStatusBadge pc={pc} />
            {isOfflineLocked && (
              <Badge variant="frozen" icon="lock">
                Locked
              </Badge>
            )}
            {pc.isOpenTime && <OpenTimeBadge />}
            <InternetBadge pc={pc} />
            <ClientUpdateStatusBadge pc={pc} />
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
          {onToggleSelect && (
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
          disabled={!isPcOnline(pc) || isLockDisabled}
          onClick={onToggleLock}
        >
          <Icon name={lockAction} />
        </Button>
        <Button
          variant="secondary"
          isIconOnly
          title={viewLabel}
          aria-label={viewLabel}
          disabled={!canViewPcScreen(pc)}
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
          disabled={!canEditPcTime(pc) || isTimeEditDisabled}
          onClick={onAddTime}
        >
          <Icon name="clock" />
        </Button>
        <Button
          variant="secondary"
          isIconOnly
          title={rebootTitle}
          aria-label={rebootLabel}
          disabled={!canRebootPc(pc) || isPowerDisabled}
          onClick={onReboot}
        >
          <Icon name="refresh" />
        </Button>
        <Button
          variant="danger"
          isIconOnly
          title={shutdownTitle}
          aria-label={shutdownLabel}
          disabled={!canShutDownPc(pc) || isPowerDisabled}
          onClick={onShutdown}
        >
          <Icon name="power" />
        </Button>
        {isPowerCancelButtonShown(pc) && (
          <Button
            variant="secondary"
            size="sm"
            aria-label={`${cancelLabel} ${pc.name}`}
            disabled={!canCancelPcPower(pc) || isPowerDisabled}
            onClick={onCancelPower}
          >
            <Icon name="x" />
            {cancelLabel}
          </Button>
        )}
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
