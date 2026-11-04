import { cn } from '../../lib/utils'

const ICONS = {
  lock: ['M7 11V8a5 5 0 0 1 10 0v3', 'M6 11h12v9H6z'],
  unlock: ['M7 11V8a5 5 0 0 1 9.6-2', 'M6 11h12v9H6z'],
  power: ['M12 3v8', 'M6.3 6.8a8 8 0 1 0 11.4 0'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  monitor: ['M3 5h18v11H3z', 'M9 20h6', 'M12 16v4'],
  eye: [
    'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z',
    'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  ],
  bell: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z', 'M10 21h4'],
  message: ['M4 5h16v11H9l-5 4z'],
  alert: ['M12 3l10 18H2z', 'M12 10v5', 'M12 18v.5'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5', 'M12 8v.5'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  plug: ['M9 3v5', 'M15 3v5', 'M7 8h10v4a5 5 0 0 1-10 0z', 'M12 17v4'],
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 20a8 8 0 0 1 16 0'],
  download: ['M12 4v11', 'M7 11l5 5 5-5', 'M5 20h14'],
  panel: ['M3 5h18v14H3z', 'M9 5v14'],
  hourglass: ['M6 3h12', 'M6 21h12', 'M7 3v4l5 5-5 5v4', 'M17 3v4l-5 5 5 5v4'],
  history: ['M3.5 9a9 9 0 1 1-.5 3', 'M3 5v4h4', 'M12 8v4l3 2'],
  shield: ['M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z'],
} as const

export type IconName = keyof typeof ICONS

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      className={cn('inline-block flex-none align-middle', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}
