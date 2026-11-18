import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

interface PasteProgressProps {
  percent: number
  onStop: () => void
}

export function PasteProgress({ percent, onStop }: PasteProgressProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-strong bg-surface-200 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Typing… {percent}%</span>
        <Button variant="secondary" size="sm" aria-label="Stop typing" onClick={onStop}>
          <Icon name="x" />
          Stop
        </Button>
      </div>
      <div
        role="progressbar"
        aria-label="Typing progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-300"
      >
        <div className="h-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
