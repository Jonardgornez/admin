import { useId } from 'react'
import { getTimeLeftLabel, isPcOff } from '../../lib/pcs'
import { getRestrictionSummary } from '../../lib/restrictions'
import type { Pc, ViewMode } from '../../types'
import { Button, ButtonLink } from '../ui/button'
import { RadioOption } from '../ui/choice'
import { Icon } from '../ui/icon'
import { Modal } from '../ui/modal'
import { OpenTimeBadge, PcStatusBadge } from './pc-status-badge'

interface PcDetailDialogProps {
  pc: Pc
  onClose: () => void
  onLock: () => void
  onUnlock: () => void
  onReboot: () => void
  onShutdown: () => void
  onAddTime: () => void
  viewMode: ViewMode
  onViewModeChange: (viewMode: ViewMode) => void
  screenHref: string
}

interface DetailRowProps {
  label: string
  value?: string
  isMono?: boolean
}

function DetailRow({ label, value, isMono = false }: DetailRowProps) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={isMono ? 'm-0 font-mono' : 'm-0 font-semibold'}>{value ?? '—'}</dd>
    </>
  )
}

export function PcDetailDialog({
  pc,
  onClose,
  onLock,
  onUnlock,
  onReboot,
  onShutdown,
  onAddTime,
  viewMode,
  onViewModeChange,
  screenHref,
}: PcDetailDialogProps) {
  const titleId = useId()
  const isBusy = isPcOff(pc) || pc.status === 'rebooting'
  const viewModeName = `view-mode-${pc.name}`

  return (
    <Modal isOpen size="sm" labelledBy={titleId} closesOnBackdropClick onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="m-0 font-mono text-xl font-semibold">
            {pc.name}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            <Icon name="x" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <PcStatusBadge status={pc.status} />
          {pc.isOpenTime && <OpenTimeBadge />}
        </div>
        <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <DetailRow label="User" value={pc.user} />
          <DetailRow label="Time used" value={pc.timeUsed} />
          <DetailRow label="Time left" value={getTimeLeftLabel(pc)} />
          <DetailRow label="Last seen" value={pc.lastSeen} />
          <DetailRow label="IP address" value={pc.ipAddress} isMono />
          <DetailRow label="Restrictions" value={getRestrictionSummary(pc.restrictions)} />
        </dl>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={isBusy} className="col-span-2" onClick={onAddTime}>
            <Icon name="clock" />
            Add time
          </Button>
          <Button variant="secondary" disabled={isBusy || pc.status === 'in-use'} onClick={onUnlock}>
            <Icon name="unlock" />
            Unlock
          </Button>
          <Button variant="secondary" disabled={isBusy || pc.status === 'locked'} onClick={onLock}>
            <Icon name="lock" />
            Lock / Freeze
          </Button>
          <Button variant="secondary" disabled={isBusy} onClick={onReboot}>
            <Icon name="refresh" />
            Reboot
          </Button>
          <Button variant="danger" disabled={isBusy} onClick={onShutdown}>
            <Icon name="power" />
            Shut down
          </Button>
        </div>
        <div className="border-t border-border pt-4">
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
              View screen
            </legend>
            <RadioOption
              name={viewModeName}
              value="notified"
              checked={viewMode === 'notified'}
              onChange={() => onViewModeChange('notified')}
            >
              Notified – the user sees a notice
            </RadioOption>
            <RadioOption
              name={viewModeName}
              value="anonymous"
              checked={viewMode === 'anonymous'}
              onChange={() => onViewModeChange('anonymous')}
            >
              Anonymous – no sign on the PC
            </RadioOption>
            <ButtonLink to={screenHref} variant="secondary">
              <Icon name="eye" />
              View screen
            </ButtonLink>
          </fieldset>
        </div>
        <div className="flex min-w-0 flex-col border-t border-border pt-4">
          <span className="text-xs font-semibold tracking-label text-ink-muted">Current user</span>
          <span className="truncate font-mono text-sm">{pc.user ?? '—'}</span>
        </div>
      </div>
    </Modal>
  )
}
