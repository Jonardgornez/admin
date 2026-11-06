import { useId } from 'react'
import {
  canCancelPcPower,
  canEditPcTime,
  canLockPc,
  canRebootPc,
  canShutDownPc,
  canUnlockPc,
  canViewPcScreen,
  getCancelPowerLabel,
  getTimeLeftLabel,
  isPowerCancelButtonShown,
  SERVER_PC_REBOOT_TITLE,
  SERVER_PC_SHUT_DOWN_TITLE,
} from '../../lib/pcs'
import { getRestrictionSummary } from '../../lib/restrictions'
import type { Pc, ViewMode } from '../../types'
import { Button, ButtonLink } from '../ui/button'
import { RadioOption } from '../ui/choice'
import { Icon } from '../ui/icon'
import { Modal } from '../ui/modal'
import { OpenTimeBadge, PcStatusBadge } from './pc-status-badge'

interface PcDetailDialogProps {
  pc: Pc
  isLockDisabled?: boolean
  isTimeEditDisabled?: boolean
  isPowerDisabled?: boolean
  onClose: () => void
  onLock?: () => void
  onUnlock?: () => void
  onReboot?: () => void
  onShutdown?: () => void
  onCancelPower?: () => void
  onAddTime?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (viewMode: ViewMode) => void
  screenHref?: string
}

interface DetailRowProps {
  label: string
  value?: string
  isMono?: boolean
}

function DetailRow({ label, value, isMono = false }: DetailRowProps) {
  if (value === undefined) return null
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className={isMono ? 'm-0 font-mono' : 'm-0 font-semibold'}>{value}</dd>
    </>
  )
}

export function PcDetailDialog({
  pc,
  isLockDisabled = false,
  isTimeEditDisabled = false,
  isPowerDisabled = false,
  onClose,
  onLock,
  onUnlock,
  onReboot,
  onShutdown,
  onCancelPower,
  onAddTime,
  viewMode = 'notified',
  onViewModeChange,
  screenHref,
}: PcDetailDialogProps) {
  const titleId = useId()
  const viewModeName = `view-mode-${pc.name}`
  const canViewScreen = canViewPcScreen(pc)

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
          <PcStatusBadge pc={pc} />
          {pc.isOpenTime && <OpenTimeBadge />}
        </div>
        <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <DetailRow label="User" value={pc.user} />
          <DetailRow label="Time used" value={pc.timeUsed} />
          <DetailRow label="Time left" value={getTimeLeftLabel(pc)} />
          <DetailRow label="Last seen" value={pc.lastSeen} />
          <DetailRow label="IP address" value={pc.ipAddress} isMono />
          <DetailRow
            label="Restrictions"
            value={pc.restrictions && getRestrictionSummary(pc.restrictions)}
          />
        </dl>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={!canEditPcTime(pc) || isTimeEditDisabled}
            className="col-span-2"
            onClick={onAddTime}
          >
            <Icon name="clock" />
            Edit time
          </Button>
          <Button
            variant="secondary"
            disabled={isLockDisabled || !canUnlockPc(pc)}
            onClick={onUnlock}
          >
            <Icon name="unlock" />
            Unlock
          </Button>
          <Button
            variant="secondary"
            disabled={isLockDisabled || !canLockPc(pc)}
            onClick={onLock}
          >
            <Icon name="lock" />
            Lock
          </Button>
          <Button
            variant="secondary"
            title={pc.isServerPc ? SERVER_PC_REBOOT_TITLE : undefined}
            disabled={!canRebootPc(pc) || isPowerDisabled}
            onClick={onReboot}
          >
            <Icon name="refresh" />
            Reboot
          </Button>
          <Button
            variant="danger"
            title={pc.isServerPc ? SERVER_PC_SHUT_DOWN_TITLE : undefined}
            disabled={!canShutDownPc(pc) || isPowerDisabled}
            onClick={onShutdown}
          >
            <Icon name="power" />
            Shut down
          </Button>
          {isPowerCancelButtonShown(pc) && (
            <Button
              variant="secondary"
              className="col-span-2"
              disabled={!canCancelPcPower(pc) || isPowerDisabled}
              onClick={onCancelPower}
            >
              <Icon name="x" />
              {getCancelPowerLabel(pc)}
            </Button>
          )}
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
              disabled={!canViewScreen}
              onChange={() => onViewModeChange?.('notified')}
            >
              Notified – the user sees a notice
            </RadioOption>
            <RadioOption
              name={viewModeName}
              value="anonymous"
              checked={viewMode === 'anonymous'}
              disabled={!canViewScreen}
              onChange={() => onViewModeChange?.('anonymous')}
            >
              Anonymous – no sign on the PC
            </RadioOption>
            {screenHref && canViewScreen ? (
              <ButtonLink to={screenHref} variant="secondary">
                <Icon name="eye" />
                View screen
              </ButtonLink>
            ) : (
              <Button variant="secondary" disabled>
                <Icon name="eye" />
                View screen
              </Button>
            )}
          </fieldset>
        </div>
      </div>
    </Modal>
  )
}
