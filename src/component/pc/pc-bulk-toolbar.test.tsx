// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PcBulkToolbar } from './pc-bulk-toolbar'

function renderToolbar(overrides: Partial<Parameters<typeof PcBulkToolbar>[0]> = {}) {
  const props = {
    hasVisiblePcs: true,
    searchQuery: '',
    onSearchChange: vi.fn(),
    ...overrides,
  }
  render(<PcBulkToolbar {...props} />)
}

function getOtherGroup() {
  return within(screen.getByRole('group', { name: 'Other' }))
}

describe('PcBulkToolbar', () => {
  it('has no Internet group, since internet is set from the Restrictions dialog', () => {
    renderToolbar()
    const labels = screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))
    expect(labels).toEqual(['Access', 'Power', 'Other'])
  })

  it('counts the PCs the Restrictions action would apply to', () => {
    renderToolbar({ restrictionTargetCount: 2 })
    expect(getOtherGroup().getByRole('button', { name: 'Restrictions (2)' })).toHaveProperty('disabled', false)
  })

  it('disables Restrictions when no selected PC can take it', () => {
    renderToolbar({ restrictionTargetCount: 0 })
    expect(getOtherGroup().getByRole('button', { name: 'Restrictions' })).toHaveProperty('disabled', true)
  })

  it('disables Restrictions while commands are not allowed', () => {
    renderToolbar({ restrictionTargetCount: 2, isRestrictionsDisabled: true })
    expect(getOtherGroup().getByRole('button', { name: 'Restrictions (2)' })).toHaveProperty('disabled', true)
  })

  it('opens Restrictions when it is clicked', () => {
    const onOpenRestrictions = vi.fn()
    renderToolbar({ restrictionTargetCount: 1, onOpenRestrictions })
    fireEvent.click(getOtherGroup().getByRole('button', { name: 'Restrictions (1)' }))
    expect(onOpenRestrictions).toHaveBeenCalledTimes(1)
  })
})
