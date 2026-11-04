import { Outlet } from 'react-router'
import { Sidebar } from './sidebar'

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-100 md:flex-row">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:px-8 md:pt-6 md:pb-8">
        <Outlet />
      </main>
    </div>
  )
}
