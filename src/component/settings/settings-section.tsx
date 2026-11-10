import type { ReactNode } from 'react'

interface SettingsSectionProps {
  id: string
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}

export function SettingsSection({ id, title, description, actions, children }: SettingsSectionProps) {
  const headingId = `${id}-heading`
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="m-0 text-xl font-semibold">
            {title}
          </h2>
          <p className="m-0 text-sm text-ink-muted">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{children}</div>
    </section>
  )
}
