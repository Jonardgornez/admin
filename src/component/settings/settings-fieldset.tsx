import type { ReactNode } from 'react'

interface SettingsFieldsetProps {
  legend: string
  children: ReactNode
}

export function SettingsFieldset({ legend, children }: SettingsFieldsetProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className="p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
        {legend}
      </legend>
      {children}
    </fieldset>
  )
}
