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

  it('counts the checked PCs on the Update action', () => {
    renderToolbar({ clientUpdateCount: 3 })
    expect(getOtherGroup().getByRole('button', { name: 'Update (3)' })).toHaveProperty('disabled', false)
  })

  it('disables Update when nothing is checked', () => {
    renderToolbar({ clientUpdateCount: 0 })
    expect(getOtherGroup().getByRole('button', { name: 'Update' })).toHaveProperty('disabled', true)
  })

  it('disables Update while it is not allowed, such as with no uploaded release or when disconnected', () => {
    renderToolbar({ clientUpdateCount: 2, isClientUpdateDisabled: true })
    expect(getOtherGroup().getByRole('button', { name: 'Update (2)' })).toHaveProperty('disabled', true)
  })

  it('starts the update when Update is clicked', () => {
    const onClientUpdate = vi.fn()
    renderToolbar({ clientUpdateCount: 2, onClientUpdate })
    fireEvent.click(getOtherGroup().getByRole('button', { name: 'Update (2)' }))
    expect(onClientUpdate).toHaveBeenCalledTimes(1)
  })

  it('enables Cancel update only when a checked PC has a pending update', () => {
    renderToolbar({ cancelClientUpdateCount: 1 })
    expect(getOtherGroup().getByRole('button', { name: 'Cancel update (1)' })).toHaveProperty('disabled', false)
  })

  it('disables Cancel update when no checked PC has a pending update', () => {
    renderToolbar({ cancelClientUpdateCount: 0 })
    expect(getOtherGroup().getByRole('button', { name: 'Cancel update' })).toHaveProperty('disabled', true)
  })

  it('cancels the pending updates when Cancel update is clicked', () => {
    const onCancelClientUpdate = vi.fn()
    renderToolbar({ cancelClientUpdateCount: 2, onCancelClientUpdate })
    fireEvent.click(getOtherGroup().getByRole('button', { name: 'Cancel update (2)' }))
    expect(onCancelClientUpdate).toHaveBeenCalledTimes(1)
  })
})
