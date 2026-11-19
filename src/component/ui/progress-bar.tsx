import { cn } from '../../lib/utils'

interface ProgressBarProps {
  label: string
  // Null shows an empty bar with no value, for progress that has not started yet.
  percent: number | null
  valueText?: string
  className?: string
}

export function ProgressBar({ label, percent, valueText, className }: ProgressBarProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-valuetext={valueText}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-300', className)}
    >
      <div className="h-full bg-brand transition-all" style={{ width: `${percent ?? 0}%` }} />
    </div>
  )
}
