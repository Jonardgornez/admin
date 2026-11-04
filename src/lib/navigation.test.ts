import { describe, expect, it } from 'vitest'
import { isNavItemActive } from './navigation'

const dashboardItem = { activePaths: ['/dashboard', '/pc'] }

describe('isNavItemActive', () => {
  it('matches an exact path', () => {
    expect(isNavItemActive(dashboardItem, '/dashboard')).toBe(true)
  })

  it('matches nested paths under an active path', () => {
    expect(isNavItemActive(dashboardItem, '/pc/PC-05/screen')).toBe(true)
  })

  it('matches the /pc root itself', () => {
    expect(isNavItemActive(dashboardItem, '/pc')).toBe(true)
  })

  it('does not match a path that only shares a prefix', () => {
    expect(isNavItemActive(dashboardItem, '/pcs')).toBe(false)
    expect(isNavItemActive(dashboardItem, '/dashboards')).toBe(false)
  })

  it('does not match unrelated paths', () => {
    expect(isNavItemActive(dashboardItem, '/accounts')).toBe(false)
  })
})
