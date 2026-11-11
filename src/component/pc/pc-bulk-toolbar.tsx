import type { ReactNode } from 'react'
import type { SelectionState } from '../../types'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { TextInput } from '../ui/field'
import { Icon } from '../ui/icon'

interface PcBulkToolbarProps {
  selectionState?: SelectionState
  selectedCount?: number
  shutdownSelectedCount?: number
  rebootSelectedCount?: number
  cancelSelectedCount?: number
  messageRecipientCount?: number
  isSendMessageDisabled?: boolean
  restrictionTargetCount?: number
  isRestrictionsDisabled?: boolean
  clientUpdateCount?: number
  isClientUpdateDisabled?: boolean
  onClientUpdate?: () => void
  cancelClientUpdateCount?: number
  isCancelClientUpdateDisabled?: boolean
  onCancelClientUpdate?: () => void
  hasVisiblePcs: boolean
  lockSelectedCount?: number
  unlockSelectedCount?: number
  isBulkLockDisabled?: boolean
  editTimeSelectedCount?: number
  isBulkTimeDisabled?: boolean
  isBulkPowerDisabled?: boolean
  searchQuery: string
  onSearchChange: (searchQuery: string) => void
  onToggleSelectAll?: () => void
  onUnlockSelected?: () => void
  onLockSelected?: () => void
  onEditTimeSelected?: () => void
  onRebootSelected?: () => void
  onShutdownSelected?: () => void
  onCancelSelected?: () => void
  onSendMessage?: () => void
  onOpenRestrictions?: () => void
  serverPcNote?: string
}

function withCount(label: string, count: number): string {
  return count > 0 ? `${label} (${count})` : label
}

interface ToolbarGroupProps {
  label: string
  children: ReactNode
}

// One group of related actions. Groups after the first are set apart by a divider on wide screens.
function ToolbarGroup({ label, children }: ToolbarGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-2 sm:border-l sm:border-border sm:pl-3 sm:first:border-l-0 sm:first:pl-0"
    >
      {children}
    </div>
  )
}

export function PcBulkToolbar({
  selectionState = 'none',
  selectedCount = 0,
  shutdownSelectedCount = 0,
  rebootSelectedCount = 0,
  cancelSelectedCount = 0,
  messageRecipientCount = 0,
  isSendMessageDisabled = false,
  restrictionTargetCount = 0,
  isRestrictionsDisabled = false,
  clientUpdateCount = 0,
  isClientUpdateDisabled = false,
  onClientUpdate,
  cancelClientUpdateCount = 0,
  isCancelClientUpdateDisabled = false,
  onCancelClientUpdate,
  hasVisiblePcs,
  lockSelectedCount = 0,
  unlockSelectedCount = 0,
  isBulkLockDisabled = false,
  editTimeSelectedCount = 0,
  isBulkTimeDisabled = false,
  isBulkPowerDisabled = false,
  searchQuery,
  onSearchChange,
  onToggleSelectAll,
  onUnlockSelected,
  onLockSelected,
  onEditTimeSelected,
  onRebootSelected,
  onShutdownSelected,
  onCancelSelected,
  onSendMessage,
  onOpenRestrictions,
  serverPcNote,
}: PcBulkToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="All PCs"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface-200 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <label htmlFor="pc-search" className="sr-only">
            Search PCs
          </label>
          <TextInput
            id="pc-search"
            type="search"
            value={searchQuery}
            placeholder="Search PCs by name"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 text-ink">
          <label className="flex h-control-md items-center gap-2">
            <Checkbox
              ref={(checkbox) => {
                if (checkbox) checkbox.indeterminate = selectionState === 'some'
              }}
              checked={selectionState === 'all'}
              disabled={!hasVisiblePcs}
              onChange={onToggleSelectAll}
            />
            Select all
          </label>
          <span aria-live="polite" className="text-sm text-ink-muted">
            {selectedCount} selected
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
        <ToolbarGroup label="Access">
          <Button
            variant="primary"
            size="sm"
            disabled={isBulkLockDisabled || unlockSelectedCount === 0}
            onClick={onUnlockSelected}
          >
            <Icon name="unlock" />
            {withCount('Unlock', unlockSelectedCount)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isBulkLockDisabled || lockSelectedCount === 0}
            onClick={onLockSelected}
          >
            <Icon name="lock" />
            {withCount('Lock', lockSelectedCount)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isBulkTimeDisabled || editTimeSelectedCount === 0}
            onClick={onEditTimeSelected}
          >
            <Icon name="clock" />
            {withCount('Edit time', editTimeSelectedCount)}
          </Button>
        </ToolbarGroup>

        <ToolbarGroup label="Power">
          <Button
            variant="secondary"
            size="sm"
            disabled={isBulkPowerDisabled || rebootSelectedCount === 0}
            onClick={onRebootSelected}
          >
            <Icon name="refresh" />
            {withCount('Reboot', rebootSelectedCount)}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={isBulkPowerDisabled || shutdownSelectedCount === 0}
            onClick={onShutdownSelected}
          >
            <Icon name="power" />
            {withCount('Shut down', shutdownSelectedCount)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isBulkPowerDisabled || cancelSelectedCount === 0}
            onClick={onCancelSelected}
          >
            <Icon name="x" />
            {withCount('Cancel power', cancelSelectedCount)}
          </Button>
        </ToolbarGroup>

        <ToolbarGroup label="Other">
          <Button
            variant="secondary"
            size="sm"
            disabled={isSendMessageDisabled || messageRecipientCount === 0}
            onClick={onSendMessage}
          >
            <Icon name="message" />
            {withCount('Message', messageRecipientCount)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isRestrictionsDisabled || restrictionTargetCount === 0}
            onClick={onOpenRestrictions}
          >
            <Icon name="shield" />
            {withCount('Restrictions', restrictionTargetCount)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isClientUpdateDisabled || clientUpdateCount === 0}
            onClick={onClientUpdate}
          >
            <Icon name="download" />
            {withCount('Update', clientUpdateCount)}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isCancelClientUpdateDisabled || cancelClientUpdateCount === 0}
            onClick={onCancelClientUpdate}
          >
            <Icon name="x" />
            {withCount('Cancel update', cancelClientUpdateCount)}
          </Button>
        </ToolbarGroup>
      </div>

      {serverPcNote && <p className="m-0 text-xs text-ink-muted">{serverPcNote}</p>}
    </div>
  )
}
