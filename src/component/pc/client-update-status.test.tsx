// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ClientUpdateStatus, Pc } from '../../types'
import { ClientUpdateStatusBadge } from './client-update-status'

const update: ClientUpdateStatus = {
  targetVersion: '0.20.0',
  state: 'pending',
  error: null,
  installNow: false,
}

type BadgePc = Pick<Pc, 'name' | 'status' | 'clientUpdate'>

const idlePc: BadgePc = { name: 'PC-01', status: 'locked', clientUpdate: update }

function renderBadge(pc: BadgePc) {
  return render(<ClientUpdateStatusBadge pc={pc} />)
}

describe('ClientUpdateStatusBadge', () => {
  it('shows nothing when no update is queued', () => {
    const { container } = renderBadge({ ...idlePc, clientUpdate: null })
    expect(container.textContent).toBe('')
  })

  it('says a pending update starts soon when the PC is idle', () => {
    renderBadge(idlePc)
    expect(screen.getByText('Update to 0.20.0 starting soon')).not.toBeNull()
  })

  it('says a pending update waits until the PC in use is free', () => {
    renderBadge({ ...idlePc, status: 'in-use' })
    expect(screen.getByText('Update to 0.20.0 — waits until PC-01 is free')).not.toBeNull()
  })

  it('says an install-now update installs after the warning when the PC is in use', () => {
    renderBadge({ ...idlePc, status: 'in-use', clientUpdate: { ...update, installNow: true } })
    expect(
      screen.getByText('Update to 0.20.0 — installing after a 60-second warning'),
    ).not.toBeNull()
  })

  it('says a pending update waits until a locked PC is unlocked, even with install now', () => {
    renderBadge({ ...idlePc, status: 'frozen', clientUpdate: { ...update, installNow: true } })
    expect(screen.getByText('Update to 0.20.0 — waits until PC-01 is unlocked')).not.toBeNull()
  })

  it('says the PC is downloading the update', () => {
    renderBadge({ ...idlePc, clientUpdate: { ...update, state: 'downloading' } })
    expect(screen.getByText('Downloading 0.20.0…')).not.toBeNull()
  })

  it('says the PC is installing the update', () => {
    renderBadge({ ...idlePc, clientUpdate: { ...update, state: 'installing' } })
    expect(screen.getByText('Installing 0.20.0…')).not.toBeNull()
  })

  it('shows the failure as text and puts the reason in the tooltip', () => {
    renderBadge({
      ...idlePc,
      clientUpdate: { ...update, state: 'failed', error: 'Not enough disk space.' },
    })
    const badge = screen.getByText('Update failed')
    expect(badge.getAttribute('title')).toBe('Not enough disk space.')
    expect(screen.getByText('Not enough disk space.')).not.toBeNull()
  })

  it('gives a reason even when the PC sent none', () => {
    renderBadge({ ...idlePc, clientUpdate: { ...update, state: 'failed', error: null } })
    expect(screen.getByText('The PC did not say why the update failed.')).not.toBeNull()
  })

  it('does not show a reason for a pending update', () => {
    renderBadge(idlePc)
    expect(screen.getByText('Update to 0.20.0 starting soon').getAttribute('title')).toBeNull()
  })
})

describe('failure text', () => {
  it('shows the reason as clamped visible text, with the full text in its title', () => {
    const reason = 'x'.repeat(150)
    renderBadge({
      ...idlePc,
      clientUpdate: { ...update, state: 'failed', error: reason },
    })
    const visible = screen.getByText(reason)
    expect(visible.className).toContain('line-clamp-2')
    expect(visible.getAttribute('title')).toBe(reason)
  })
})
