import { getLogsHref, getScreenHref } from '../../lib/pcs'
import type { Pc, ViewMode } from '../../types'
import { PcCard } from './pc-card'

interface PcGridProps {
  pcs: Pc[]
  selectedNames: string[]
  isDisabled: boolean
  viewMode: ViewMode
  emptyMessage: string
  onToggleSelect: (pcName: string) => void
  onOpenDetail: (pcName: string) => void
  onToggleLock: (pcName: string) => void
  onViewScreen: (href: string) => void
  onAddTime: (pcName: string) => void
  onShutdown: (pcName: string) => void
}

export function PcGrid({
  pcs,
  selectedNames,
  isDisabled,
  viewMode,
  emptyMessage,
  onToggleSelect,
  onOpenDetail,
  onToggleLock,
  onViewScreen,
  onAddTime,
  onShutdown,
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
              isDisabled={isDisabled}
              historyHref={getLogsHref(pc.name)}
              onToggleSelect={() => onToggleSelect(pc.name)}
              onOpenDetail={() => onOpenDetail(pc.name)}
              onToggleLock={() => onToggleLock(pc.name)}
              onViewScreen={() => onViewScreen(getScreenHref(pc.name, viewMode))}
              onAddTime={() => onAddTime(pc.name)}
              onShutdown={() => onShutdown(pc.name)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
