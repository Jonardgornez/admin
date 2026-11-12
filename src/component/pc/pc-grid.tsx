import { getLogsHref, getScreenHref } from '../../lib/pcs'
import type { RegisteredPc, ViewMode } from '../../types'
import { PcCard } from './pc-card'

interface PcGridProps {
  pcs: RegisteredPc[]
  now: Date
  selectedIds?: number[]
  viewMode?: ViewMode
  emptyMessage: string
  isLockDisabled?: (pcId: number) => boolean
  isTimeEditDisabled?: (pcId: number) => boolean
  isRemoveDisabled?: (pcId: number) => boolean
  isPowerDisabled?: (pcId: number) => boolean
  onToggleSelect?: (pcId: number) => void
  onOpenDetail: (pcId: number) => void
  onToggleLock?: (pcId: number) => void
  onViewScreen?: (href: string) => void
  onAddTime?: (pcId: number) => void
  onReboot?: (pcId: number) => void
  onShutdown?: (pcId: number) => void
  onCancelPower?: (pcId: number) => void
  onRemove?: (pcId: number) => void
}

export function PcGrid({
  pcs,
  now,
  selectedIds = [],
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
  onCancelPower,
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
              key={pc.id}
              pc={pc}
              now={now}
              isSelected={selectedIds.includes(pc.id)}
              isLockDisabled={isLockDisabled?.(pc.id)}
              isTimeEditDisabled={isTimeEditDisabled?.(pc.id)}
              isRemoveDisabled={isRemoveDisabled?.(pc.id)}
              isPowerDisabled={isPowerDisabled?.(pc.id)}
              historyHref={getLogsHref(pc.name)}
              onToggleSelect={onToggleSelect && (() => onToggleSelect(pc.id))}
              onOpenDetail={() => onOpenDetail(pc.id)}
              onToggleLock={onToggleLock && (() => onToggleLock(pc.id))}
              onViewScreen={onViewScreen && (() => onViewScreen(getScreenHref(pc.id, viewMode)))}
              onAddTime={onAddTime && (() => onAddTime(pc.id))}
              onReboot={onReboot && (() => onReboot(pc.id))}
              onShutdown={onShutdown && (() => onShutdown(pc.id))}
              onCancelPower={onCancelPower && (() => onCancelPower(pc.id))}
              onRemove={onRemove && (() => onRemove(pc.id))}
            />
          ))}
        </div>
      )}
    </section>
  )
}
