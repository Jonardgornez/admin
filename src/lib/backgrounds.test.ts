import { describe, expect, it } from 'vitest'
import { formatBackgroundSize, formatBackgroundUpdated } from './backgrounds'

describe('formatBackgroundSize', () => {
  it('shows whole kilobytes below one megabyte', () => {
    expect(formatBackgroundSize(512 * 1024)).toBe('512 KB')
  })

  it('never shows zero kilobytes for a tiny file', () => {
    expect(formatBackgroundSize(10)).toBe('1 KB')
  })

  it('shows one decimal place in megabytes', () => {
    expect(formatBackgroundSize(1258291)).toBe('1.2 MB')
  })
})

describe('formatBackgroundUpdated', () => {
  it('starts with "Updated" and includes the date', () => {
    const text = formatBackgroundUpdated('2026-11-10T09:30:00.000Z')
    expect(text.startsWith('Updated ')).toBe(true)
    expect(text.length).toBeGreaterThan('Updated '.length)
  })
})
