export interface NavActivation {
  activePaths: string[]
}

export function isNavItemActive(item: NavActivation, pathname: string): boolean {
  return item.activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}
