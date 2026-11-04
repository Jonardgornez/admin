import type { ReactNode } from 'react'
import { AdminUserBlock } from './admin-user-block'

interface PageHeaderProps {
  title: ReactNode
  meta?: ReactNode
  description?: string
  children?: ReactNode
}

export function PageHeader({ title, meta, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="m-0 text-2xl font-semibold">{title}</h1>
          {meta}
        </div>
        {description && <p className="m-0 text-ink-muted">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <AdminUserBlock />
      </div>
    </div>
  )
}
