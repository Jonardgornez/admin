import { useState } from 'react'
import { cva } from 'class-variance-authority'
import { Link, useLocation } from 'react-router'
import { isNavItemActive } from '../../lib/navigation'
import { Button } from '../ui/button'
import { Icon, type IconName } from '../ui/icon'
import { useNavigationLock } from './navigation-lock-context'

interface NavItem {
  label: string
  to: string
  icon: IconName
  activePaths: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'monitor', activePaths: ['/dashboard', '/pc'] },
  { label: 'Accounts', to: '/accounts', icon: 'user', activePaths: ['/accounts'] },
  { label: 'Login requests', to: '/requests', icon: 'bell', activePaths: ['/requests'] },
  { label: 'Logs and reports', to: '/logs', icon: 'clock', activePaths: ['/logs'] },
  { label: 'Settings', to: '/settings', icon: 'info', activePaths: ['/settings'] },
]

const sidebarVariants = cva(
  'flex flex-col gap-1 border-b border-border bg-surface-200 px-4 py-4 md:sticky md:top-0 md:h-screen md:flex-none md:overflow-y-auto md:border-r md:border-b-0 md:py-6 md:transition-[width] motion-reduce:transition-none',
  {
    variants: {
      isCollapsed: {
        true: 'md:w-sidebar-collapsed',
        false: 'md:w-sidebar',
      },
    },
  },
)

const headerVariants = cva('flex items-center pb-2 md:pb-4', {
  variants: {
    isCollapsed: {
      true: 'justify-between md:justify-center',
      false: 'justify-between',
    },
  },
})

const wordmarkVariants = cva('px-3 text-xl font-bold', {
  variants: {
    isCollapsed: {
      true: 'md:hidden',
      false: '',
    },
  },
})

const linkLabelVariants = cva('', {
  variants: {
    isCollapsed: {
      true: 'md:sr-only',
      false: '',
    },
  },
})

export function Sidebar() {
  const { pathname } = useLocation()
  const { isNavigationLocked } = useNavigationLock()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const toggleLabel = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <nav aria-label="Main" className={sidebarVariants({ isCollapsed })}>
      <div className={headerVariants({ isCollapsed })}>
        <span className={wordmarkVariants({ isCollapsed })}>LabGuard</span>
        <Button
          variant="ghost"
          isIconOnly
          aria-label={toggleLabel}
          title={toggleLabel}
          className="hidden md:inline-flex"
          onClick={() => setIsCollapsed((current) => !current)}
        >
          <Icon name="panel" />
        </Button>
      </div>
      <ul
        inert={isNavigationLocked}
        className="m-0 flex list-none gap-1 overflow-x-auto p-0 inert:opacity-disabled md:flex-col md:overflow-visible"
      >
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-none">
            <Link
              to={item.to}
              title={isCollapsed ? item.label : undefined}
              aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
              className="flex h-control-md items-center gap-2.5 rounded-md px-3 whitespace-nowrap text-ink no-underline hover:bg-surface-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:bg-brand-tint aria-[current=page]:font-semibold aria-[current=page]:text-brand"
            >
              <Icon name={item.icon} />
              <span className={linkLabelVariants({ isCollapsed })}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
