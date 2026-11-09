// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PcBulkToolbar } from './pc-bulk-toolbar'

function renderToolbar(overrides: Partial<Parameters<typeof PcBulkToolbar>[0]> = {}) {
  const props = {
    hasVisiblePcs: true,
    areCommandsDisabled: false,
    searchQuery: '',
    onSearchChange: vi.fn(),
    ...overrides,
  }
  render(<PcBulkToolbar {...props} />)
  return screen.getByRole('group', { name: 'Internet' })
}

describe('PcBulkToolbar internet group', () => {
  it('sits between Access and Power', () => {
    renderToolbar()
    const labels = screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))
    expect(labels).toEqual(['Access', 'Internet', 'Power', 'Other'])
  })

  it('counts the PCs each internet action would change', () => {
    const group = renderToolbar({ internetOffSelectedCount: 2, internetOnSelectedCount: 1 })
    expect(within(group).getByRole('button', { name: 'Internet off (2)' })).toHaveProperty('disabled', false)
    expect(within(group).getByRole('button', { name: 'Internet on (1)' })).toHaveProperty('disabled', false)
  })

  it('disables an action when no selected PC needs it', () => {
    const group = renderToolbar({ internetOffSelectedCount: 0, internetOnSelectedCount: 3 })
    expect(within(group).getByRole('button', { name: 'Internet off' })).toHaveProperty('disabled', true)
    expect(within(group).getByRole('button', { name: 'Internet on (3)' })).toHaveProperty('disabled', false)
  })

  it('disables both actions while internet changes are not allowed', () => {
    const group = renderToolbar({
      internetOffSelectedCount: 2,
      internetOnSelectedCount: 2,
      isBulkInternetDisabled: true,
    })
    expect(within(group).getByRole('button', { name: 'Internet off (2)' })).toHaveProperty('disabled', true)
    expect(within(group).getByRole('button', { name: 'Internet on (2)' })).toHaveProperty('disabled', true)
  })

  it('calls the matching handler when an action is clicked', () => {
    const onInternetOffSelected = vi.fn()
    const onInternetOnSelected = vi.fn()
    const group = renderToolbar({
      internetOffSelectedCount: 1,
      internetOnSelectedCount: 1,
      onInternetOffSelected,
      onInternetOnSelected,
    })
    fireEvent.click(within(group).getByRole('button', { name: 'Internet off (1)' }))
    expect(onInternetOffSelected).toHaveBeenCalledTimes(1)
    expect(onInternetOnSelected).not.toHaveBeenCalled()
    fireEvent.click(within(group).getByRole('button', { name: 'Internet on (1)' }))
    expect(onInternetOnSelected).toHaveBeenCalledTimes(1)
  })
})
