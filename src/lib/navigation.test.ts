import { describe, expect, it } from 'vitest'
import { buildScreensReturnState, isNavItemActive, readScreensReturnTo } from './navigation'

describe('Screens return address', () => {
  it('keeps the Screens page options', () => {
    expect(buildScreensReturnState('?mode=anonymous&size=lg')).toEqual({
      returnTo: '/screens?mode=anonymous&size=lg',
    })
    expect(buildScreensReturnState('')).toEqual({ returnTo: '/screens' })
  })

  it('reads a Screens page address back', () => {
    expect(readScreensReturnTo({ returnTo: '/screens' })).toBe('/screens')
    expect(readScreensReturnTo({ returnTo: '/screens?size=sm' })).toBe('/screens?size=sm')
  })

  it('refuses anything that is not the Screens page', () => {
    for (const state of [
      null,
      undefined,
      'screens',
      {},
      { returnTo: 5 },
      { returnTo: '/dashboard' },
      { returnTo: '/screensx' },
      { returnTo: '/screens/../accounts' },
      { returnTo: 'https://example.com/screens' },
      { returnTo: '//evil/screens' },
    ]) {
      expect(readScreensReturnTo(state)).toBeNull()
    }
  })
})

const dashboardItem = { activePaths: ['/dashboard', '/pc'] }

describe('isNavItemActive', () => {
  it('matches an exact path', () => {
    expect(isNavItemActive(dashboardItem, '/dashboard')).toBe(true)
  })

  it('matches nested paths under an active path', () => {
    expect(isNavItemActive(dashboardItem, '/pc/5/screen')).toBe(true)
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
