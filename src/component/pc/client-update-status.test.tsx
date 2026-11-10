// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ClientUpdateStatus } from '../../types'
import { ClientUpdateStatusBadge } from './client-update-status'

const update: ClientUpdateStatus = { targetVersion: '0.20.0', state: 'pending', error: null }

describe('ClientUpdateStatusBadge', () => {
  it('shows nothing when no update is queued', () => {
    const { container } = render(<ClientUpdateStatusBadge clientUpdate={null} />)
    expect(container.textContent).toBe('')
  })

  it('says an update is waiting for the PC', () => {
    render(<ClientUpdateStatusBadge clientUpdate={update} />)
    expect(screen.getByText('Update to 0.20.0 waiting')).not.toBeNull()
  })

  it('says the PC is downloading the update', () => {
    render(<ClientUpdateStatusBadge clientUpdate={{ ...update, state: 'downloading' }} />)
    expect(screen.getByText('Downloading 0.20.0…')).not.toBeNull()
  })

  it('says the PC is installing the update', () => {
    render(<ClientUpdateStatusBadge clientUpdate={{ ...update, state: 'installing' }} />)
    expect(screen.getByText('Installing 0.20.0…')).not.toBeNull()
  })

  it('shows the failure as text and puts the reason in the tooltip', () => {
    render(
      <ClientUpdateStatusBadge
        clientUpdate={{ ...update, state: 'failed', error: 'Not enough disk space.' }}
      />,
    )
    const badge = screen.getByText('Update failed')
    expect(badge.getAttribute('title')).toBe('Not enough disk space.')
    expect(screen.getByText('Not enough disk space.')).not.toBeNull()
  })

  it('gives a reason even when the PC sent none', () => {
    render(<ClientUpdateStatusBadge clientUpdate={{ ...update, state: 'failed', error: null }} />)
    expect(screen.getByText('The PC did not say why the update failed.')).not.toBeNull()
  })

  it('does not show a reason for a pending update', () => {
    render(<ClientUpdateStatusBadge clientUpdate={update} />)
    expect(screen.getByText('Update to 0.20.0 waiting').getAttribute('title')).toBeNull()
  })
})

describe('failure text', () => {
  it('shows the reason as clamped visible text, with the full text in its title', () => {
    const reason = 'x'.repeat(150)
    render(
      <ClientUpdateStatusBadge
        clientUpdate={{ targetVersion: '0.20.0', state: 'failed', error: reason }}
      />,
    )
    const visible = screen.getByText(reason)
    expect(visible.className).toContain('line-clamp-2')
    expect(visible.getAttribute('title')).toBe(reason)
  })
})
