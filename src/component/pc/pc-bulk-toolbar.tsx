import { Button } from '../ui/button'
import { Field, TextInput } from '../ui/field'
import { Icon } from '../ui/icon'

interface PcBulkToolbarProps {
  selectedCount: number
  isDisabled: boolean
  searchQuery: string
  onSearchChange: (searchQuery: string) => void
  onUnlockAll: () => void
  onLockAll: () => void
  onShutdownSelected: () => void
  onSendMessage: () => void
  note?: string
}

export function PcBulkToolbar({
  selectedCount,
  isDisabled,
  searchQuery,
  onSearchChange,
  onUnlockAll,
  onLockAll,
  onShutdownSelected,
  onSendMessage,
  note,
}: PcBulkToolbarProps) {
  const shutdownLabel =
    selectedCount > 0 ? `Shut down selected (${selectedCount})` : 'Shut down selected'

  return (
    <div
      role="toolbar"
      aria-label="All PCs"
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-200 p-3"
    >
      <Button variant="primary" disabled={isDisabled} onClick={onUnlockAll}>
        <Icon name="unlock" />
        Unlock all
      </Button>
      <Button variant="secondary" disabled={isDisabled} onClick={onLockAll}>
        <Icon name="lock" />
        Lock all
      </Button>
      <Button
        variant="danger"
        disabled={isDisabled || selectedCount === 0}
        onClick={onShutdownSelected}
      >
        <Icon name="power" />
        {shutdownLabel}
      </Button>
      <Button variant="secondary" disabled={isDisabled} onClick={onSendMessage}>
        <Icon name="message" />
        Send message
      </Button>
      {isDisabled ? (
        note && <span className="self-center px-2 text-xs text-ink-muted">{note}</span>
      ) : (
        <Field label="Search PCs" htmlFor="pc-search" className="w-full sm:ml-auto sm:w-60">
          <TextInput
            id="pc-search"
            value={searchQuery}
            placeholder="PC number or user"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </Field>
      )}
    </div>
  )
}
