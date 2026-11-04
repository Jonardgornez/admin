import { Link, useLocation } from 'react-router'
import { Icon, type IconName } from '../ui/icon'

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

function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function Sidebar() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-1 border-b border-border bg-surface-200 px-4 py-4 md:w-sidebar md:flex-none md:border-r md:border-b-0 md:py-6"
    >
      <span className="px-3 pb-2 text-xl font-bold md:pb-4">LabGuard</span>
      <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 md:flex-col md:overflow-visible">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-none">
            <Link
              to={item.to}
              aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
              className="flex h-control-md items-center gap-2.5 rounded-md px-3 whitespace-nowrap text-ink no-underline hover:bg-surface-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:bg-brand-tint aria-[current=page]:font-semibold aria-[current=page]:text-brand"
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
