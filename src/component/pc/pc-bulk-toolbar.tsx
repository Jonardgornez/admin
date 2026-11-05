import type { SelectionState } from '../../types'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Field, TextInput } from '../ui/field'
import { Icon } from '../ui/icon'

interface PcBulkToolbarProps {
  selectionState?: SelectionState
  selectedCount?: number
  messageRecipientCount?: number
  restrictionTargetCount?: number
  hasVisiblePcs: boolean
  areCommandsDisabled: boolean
  pcsToLockCount?: number
  pcsToUnlockCount?: number
  isLockAllDisabled?: boolean
  searchQuery: string
  onSearchChange: (searchQuery: string) => void
  onToggleSelectAll?: () => void
  onUnlockAll?: () => void
  onLockAll?: () => void
  onShutdownSelected?: () => void
  onSendMessage?: () => void
  onOpenRestrictions?: () => void
  note?: string
}

function withCount(label: string, count: number): string {
  return count > 0 ? `${label} (${count})` : label
}

export function PcBulkToolbar({
  selectionState = 'none',
  selectedCount = 0,
  messageRecipientCount = 0,
  restrictionTargetCount = 0,
  hasVisiblePcs,
  areCommandsDisabled,
  pcsToLockCount = 0,
  pcsToUnlockCount = 0,
  isLockAllDisabled = false,
  searchQuery,
  onSearchChange,
  onToggleSelectAll,
  onUnlockAll,
  onLockAll,
  onShutdownSelected,
  onSendMessage,
  onOpenRestrictions,
  note,
}: PcBulkToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="All PCs"
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-200 p-3"
    >
      {!areCommandsDisabled && (
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
      )}
      <Button
        variant="primary"
        disabled={isLockAllDisabled || pcsToUnlockCount === 0}
        onClick={onUnlockAll}
      >
        <Icon name="unlock" />
        Unlock all
      </Button>
      <Button
        variant="secondary"
        disabled={isLockAllDisabled || pcsToLockCount === 0}
        onClick={onLockAll}
      >
        <Icon name="lock" />
        Lock all
      </Button>
      <Button
        variant="danger"
        disabled={areCommandsDisabled || selectedCount === 0}
        onClick={onShutdownSelected}
      >
        <Icon name="power" />
        {withCount('Shut down selected', selectedCount)}
      </Button>
      <Button
        variant="secondary"
        disabled={areCommandsDisabled || messageRecipientCount === 0}
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
      {areCommandsDisabled && note && (
        <span className="self-center px-2 text-xs text-ink-muted">{note}</span>
      )}
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
