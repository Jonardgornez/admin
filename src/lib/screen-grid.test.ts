import { describe, expect, it } from 'vitest'
import type { Pc } from '../types'
import {
  countViewablePcs,
  getScreenTileName,
  orderScreenGridPcs,
  parseTileSizeParam,
  parseViewModeParam,
} from './screen-grid'

function pc(name: string, status: Pc['status']): Pc {
  return { name, status } as Pc
}

const PCS = [
  pc('PC-1', 'offline'),
  pc('PC-2', 'in-use'),
  pc('PC-3', 'shutdown'),
  pc('PC-10', 'locked'),
]

describe('parseViewModeParam', () => {
  it('reads either mode', () => {
    expect(parseViewModeParam('anonymous')).toBe('anonymous')
    expect(parseViewModeParam('notified')).toBe('notified')
  })

  it('gives null for a missing or unknown mode, so the saved default applies', () => {
    expect(parseViewModeParam(null)).toBeNull()
    expect(parseViewModeParam('secret')).toBeNull()
  })
})

describe('parseTileSizeParam', () => {
  it('reads a known size', () => {
    expect(parseTileSizeParam('large')).toBe('large')
  })

  it('falls back to small', () => {
    expect(parseTileSizeParam(null)).toBe('small')
    expect(parseTileSizeParam('huge')).toBe('small')
  })
})

describe('orderScreenGridPcs', () => {
  it('puts viewable PCs first and keeps the server order within each group', () => {
    expect(orderScreenGridPcs(PCS, true).map((item) => item.name)).toEqual([
      'PC-2',
      'PC-10',
      'PC-1',
      'PC-3',
    ])
  })

  it('leaves offline PCs out unless they are shown', () => {
    expect(orderScreenGridPcs(PCS, false).map((item) => item.name)).toEqual(['PC-2', 'PC-10'])
  })
})

describe('countViewablePcs', () => {
  it('counts the PCs whose screen can be viewed', () => {
    expect(countViewablePcs(PCS)).toBe(2)
  })
})

describe('getScreenTileName', () => {
  it('names the PC and its status', () => {
    expect(getScreenTileName('PC-3', { kind: 'live' }, false)).toBe('PC-3 screen, live')
  })

  it('says when the PC has too many views open', () => {
    expect(getScreenTileName('PC-3', { kind: 'ended', message: 'x' }, true)).toBe(
      'PC-3 screen, too many views open',
    )
  })
})
