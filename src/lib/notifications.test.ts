import { describe, expect, it } from 'vitest'
import {
  MAX_VISIBLE_NOTIFICATIONS,
  addNotification,
  removeNotification,
  type AppNotification,
} from './notifications'

function make(id: number): AppNotification {
  return { id, message: `Message ${id}`, icon: 'check' }
}

describe('addNotification', () => {
  it('appends the newest notification last', () => {
    expect(addNotification([make(1)], make(2)).map((n) => n.id)).toEqual([1, 2])
  })

  it('evicts the oldest when over the limit', () => {
    const full = [make(1), make(2), make(3)]
    expect(full).toHaveLength(MAX_VISIBLE_NOTIFICATIONS)
    expect(addNotification(full, make(4)).map((n) => n.id)).toEqual([2, 3, 4])
  })

  it('does not mutate the original list', () => {
    const list = [make(1), make(2), make(3)]
    const result = addNotification(list, make(4))
    expect(result).not.toBe(list)
    expect(list.map((n) => n.id)).toEqual([1, 2, 3])
  })
})

describe('removeNotification', () => {
  it('removes only the matching id', () => {
    expect(removeNotification([make(1), make(2)], 1).map((n) => n.id)).toEqual([2])
  })

  it('returns an equal list for an unknown id', () => {
    expect(removeNotification([make(1)], 9)).toEqual([make(1)])
  })

  it('does not mutate the original list', () => {
    const list = [make(1), make(2)]
    const result = removeNotification(list, 1)
    expect(result).not.toBe(list)
    expect(list).toHaveLength(2)
  })
})
