export interface NavActivation {
  activePaths: string[]
}

export function isNavItemActive(item: NavActivation, pathname: string): boolean {
  return item.activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export const SCREENS_PATH = '/screens'

// Router state a page passes when it opens a PC's full view, so the view's Back link can return there.
export interface ReturnToState {
  returnTo: string
}

export function buildScreensReturnState(search: string): ReturnToState {
  return { returnTo: `${SCREENS_PATH}${search}` }
}

// The Screens page address to go back to, or null. Only the Screens page is accepted, so state can't send Back elsewhere.
export function readScreensReturnTo(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return null
  const { returnTo } = state
  if (typeof returnTo !== 'string') return null
  return returnTo === SCREENS_PATH || returnTo.startsWith(`${SCREENS_PATH}?`) ? returnTo : null
}
