import type { ReactNode } from 'react'

interface SettingsCardProps {
  title: string
  children: ReactNode
}

export function SettingsCard({ title, children }: SettingsCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface-200 p-5">
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}
