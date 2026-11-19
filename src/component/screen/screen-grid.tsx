import { cva } from 'class-variance-authority'
import { canViewPcScreen } from '../../lib/pcs'
import { orderScreenGridPcs, type TileSize } from '../../lib/screen-grid'
import type { RegisteredPc, ViewMode } from '../../types'
import { OfflineScreenTile, ScreenTile } from './screen-tile'

const gridVariants = cva('m-0 grid list-none gap-4 p-0', {
  variants: {
    size: {
      small: 'grid-cols-[repeat(auto-fill,minmax(min(var(--spacing-screen-tile-sm),100%),1fr))]',
      medium: 'grid-cols-[repeat(auto-fill,minmax(min(var(--spacing-screen-tile-md),100%),1fr))]',
      large: 'grid-cols-[repeat(auto-fill,minmax(min(var(--spacing-screen-tile-lg),100%),1fr))]',
    },
  },
})

interface ScreenGridProps {
  pcs: RegisteredPc[]
  mode: ViewMode
  size: TileSize
  isOfflineShown: boolean
  emptyMessage: string
}

export function ScreenGrid({ pcs, mode, size, isOfflineShown, emptyMessage }: ScreenGridProps) {
  const orderedPcs = orderScreenGridPcs(pcs, isOfflineShown)

  if (orderedPcs.length === 0) {
    return (
      <p className="m-0 rounded-lg border border-border bg-surface-200 p-6 text-center text-ink-muted">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul aria-label="PC screens" className={gridVariants({ size })}>
      {orderedPcs.map((pc) =>
        canViewPcScreen(pc) ? (
          <ScreenTile key={pc.id} pcId={pc.id} pcName={pc.name} mode={mode} />
        ) : (
          <OfflineScreenTile key={pc.id} pcName={pc.name} />
        ),
      )}
    </ul>
  )
}
