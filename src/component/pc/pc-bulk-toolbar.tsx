import type { SelectionState } from '../../types'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Field, TextInput } from '../ui/field'
import { Icon } from '../ui/icon'

interface PcBulkToolbarProps {
  selectionState?: SelectionState
  shutdownSelectedCount?: number
  rebootSelectedCount?: number
  cancelSelectedCount?: number
  messageRecipientCount?: number
  isSendMessageDisabled?: boolean
  restrictionTargetCount?: number
  hasVisiblePcs: boolean
  areCommandsDisabled: boolean
  lockSelectedCount?: number
  unlockSelectedCount?: number
  isBulkLockDisabled?: boolean
  isBulkPowerDisabled?: boolean
  searchQuery: string
  onSearchChange: (searchQuery: string) => void
  onToggleSelectAll?: () => void
  onUnlockSelected?: () => void
  onLockSelected?: () => void
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

export function PcBulkToolbar({
  selectionState = 'none',
  shutdownSelectedCount = 0,
  rebootSelectedCount = 0,
  cancelSelectedCount = 0,
  messageRecipientCount = 0,
  isSendMessageDisabled = false,
  restrictionTargetCount = 0,
  hasVisiblePcs,
  areCommandsDisabled,
  lockSelectedCount = 0,
  unlockSelectedCount = 0,
  isBulkLockDisabled = false,
  isBulkPowerDisabled = false,
  searchQuery,
  onSearchChange,
  onToggleSelectAll,
  onUnlockSelected,
  onLockSelected,
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
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-200 p-3"
    >
      <label className="flex h-control-md items-center gap-2 pr-2 text-ink">
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
      <Button
        variant="primary"
        disabled={isBulkLockDisabled || unlockSelectedCount === 0}
        onClick={onUnlockSelected}
      >
        <Icon name="unlock" />
        {`Unlock selected (${unlockSelectedCount})`}
      </Button>
      <Button
        variant="secondary"
        disabled={isBulkLockDisabled || lockSelectedCount === 0}
        onClick={onLockSelected}
      >
        <Icon name="lock" />
        {`Lock selected (${lockSelectedCount})`}
      </Button>
      <Button
        variant="secondary"
        disabled={isBulkPowerDisabled || rebootSelectedCount === 0}
        onClick={onRebootSelected}
      >
        <Icon name="refresh" />
        {`Reboot selected (${rebootSelectedCount})`}
      </Button>
      <Button
        variant="danger"
        disabled={isBulkPowerDisabled || shutdownSelectedCount === 0}
        onClick={onShutdownSelected}
      >
        <Icon name="power" />
        {`Shut down selected (${shutdownSelectedCount})`}
      </Button>
      <Button
        variant="secondary"
        disabled={isBulkPowerDisabled || cancelSelectedCount === 0}
        onClick={onCancelSelected}
      >
        <Icon name="x" />
        {`Cancel selected (${cancelSelectedCount})`}
      </Button>
      {serverPcNote && (
        <span className="self-center px-2 text-xs text-ink-muted">{serverPcNote}</span>
      )}
      <Button
        variant="secondary"
        disabled={isSendMessageDisabled || messageRecipientCount === 0}
        onClick={onSendMessage}
      >
        <Icon name="message" />
        {withCount('Send message', messageRecipientCount)}
      </Button>
      <Button
        variant="secondary"
        disabled={areCommandsDisabled || restrictionTargetCount === 0}
        onClick={onOpenRestrictions}
      >
        <Icon name="shield" />
        {withCount('Restrictions', restrictionTargetCount)}
      </Button>
      <Field label="Search PCs" htmlFor="pc-search" className="w-full sm:ml-auto sm:w-60">
        <TextInput
          id="pc-search"
          value={searchQuery}
          placeholder="PC name"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </Field>
    </div>
  )
}
