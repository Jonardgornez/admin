import { getLogsHref, getScreenHref } from '../../lib/pcs'
import type { Pc, ViewMode } from '../../types'
import { PcCard } from './pc-card'

interface PcGridProps {
  pcs: Pc[]
  selectedNames?: string[]
  areCommandsDisabled: boolean
  viewMode?: ViewMode
  emptyMessage: string
  isLockDisabled?: (pcName: string) => boolean
  isTimeEditDisabled?: (pcName: string) => boolean
  isRemoveDisabled?: (pcName: string) => boolean
  isPowerDisabled?: (pcName: string) => boolean
  onToggleSelect?: (pcName: string) => void
  onOpenDetail: (pcName: string) => void
  onToggleLock?: (pcName: string) => void
  onViewScreen?: (href: string) => void
  onAddTime?: (pcName: string) => void
  onReboot?: (pcName: string) => void
  onShutdown?: (pcName: string) => void
  onRemove?: (pcName: string) => void
}

export function PcGrid({
  pcs,
  selectedNames = [],
  areCommandsDisabled,
  viewMode = 'notified',
  emptyMessage,
  isLockDisabled,
  isTimeEditDisabled,
  isRemoveDisabled,
  isPowerDisabled,
  onToggleSelect,
  onOpenDetail,
  onToggleLock,
  onViewScreen,
  onAddTime,
  onReboot,
  onShutdown,
  onRemove,
}: PcGridProps) {
  return (
    <section aria-labelledby="pc-grid-title" className="min-w-0">
      <h2 id="pc-grid-title" className="sr-only">
        PCs
      </h2>
      {pcs.length === 0 ? (
        <p className="m-0 rounded-lg border border-border bg-surface-200 p-6 text-center text-ink-muted">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(var(--spacing-pc-card),100%),1fr))] gap-4">
          {pcs.map((pc) => (
            <PcCard
              key={pc.name}
              pc={pc}
              isSelected={selectedNames.includes(pc.name)}
              areCommandsDisabled={areCommandsDisabled}
              isLockDisabled={isLockDisabled?.(pc.name)}
              isTimeEditDisabled={isTimeEditDisabled?.(pc.name)}
              isRemoveDisabled={isRemoveDisabled?.(pc.name)}
              isPowerDisabled={isPowerDisabled?.(pc.name)}
              historyHref={getLogsHref(pc.name)}
              onToggleSelect={onToggleSelect && (() => onToggleSelect(pc.name))}
              onOpenDetail={() => onOpenDetail(pc.name)}
              onToggleLock={onToggleLock && (() => onToggleLock(pc.name))}
              onViewScreen={onViewScreen && (() => onViewScreen(getScreenHref(pc.name, viewMode)))}
              onAddTime={onAddTime && (() => onAddTime(pc.name))}
              onReboot={onReboot && (() => onReboot(pc.name))}
              onShutdown={onShutdown && (() => onShutdown(pc.name))}
              onRemove={onRemove && (() => onRemove(pc.name))}
            />
          ))}
        </div>
      )}
    </section>
  )
}
