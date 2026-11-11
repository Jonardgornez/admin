// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TestProviders } from '../../test/test-providers'
import type { Pc } from '../../types'
import { PcCard } from './pc-card'

const onlinePc: Pc = { name: 'PC-01', status: 'locked', lastSeen: 'Now', clientVersion: '0.19.0' }

function renderCard(pc: Pc) {
  render(
    <TestProviders>
      <PcCard
        pc={pc}
        now={new Date()}
        isSelected={false}
        historyHref="/logs?pc=PC-01"
        onOpenDetail={vi.fn()}
      />
    </TestProviders>,
  )
}

describe('PcCard client version', () => {
  it('shows the client version under the PC name', () => {
    renderCard(onlinePc)
    expect(screen.getByText('v0.19.0')).not.toBeNull()
  })

  it('says the version is unknown when the PC has not reported one', () => {
    renderCard({ ...onlinePc, clientVersion: null })
    expect(screen.getByText('Version unknown')).not.toBeNull()
  })

  it('shows no update badge when none is queued', () => {
    renderCard(onlinePc)
    expect(screen.queryByText(/waiting|Downloading|Installing|Update failed/)).toBeNull()
  })

  it('says an in-use PC waits for its student to leave before the update', () => {
    renderCard({
      ...onlinePc,
      status: 'in-use',
      user: 'maria',
      clientUpdate: { targetVersion: '0.20.0', state: 'pending', error: null, installNow: false },
    })
    expect(screen.getByText('Update to 0.20.0 — waits until PC-01 is free')).not.toBeNull()
  })

  it('shows the queued update on the card', () => {
    renderCard({
      ...onlinePc,
      clientUpdate: {
        targetVersion: '0.20.0',
        state: 'downloading',
        error: null,
        installNow: false,
      },
    })
    expect(screen.getByText('Downloading 0.20.0…')).not.toBeNull()
  })
})

describe('PcCard wallpaper', () => {
  it('shows a labelled Wallpaper set badge when the PC has a wallpaper', () => {
    renderCard({ ...onlinePc, wallpaperId: 4 })
    expect(screen.getByText('Wallpaper set')).not.toBeNull()
  })

  it('shows no wallpaper badge when the PC has none', () => {
    renderCard({ ...onlinePc, wallpaperId: null })
    expect(screen.queryByText('Wallpaper set')).toBeNull()
  })
})

describe('PcCard always awake', () => {
  it('shows a labelled Always awake badge when the PC is kept awake', () => {
    renderCard({ ...onlinePc, keepAwake: true })
    expect(screen.getByText('Always awake')).not.toBeNull()
  })

  it('shows no always awake badge when the setting is off', () => {
    renderCard({ ...onlinePc, keepAwake: false })
    expect(screen.queryByText('Always awake')).toBeNull()
  })
})

describe('PcCard service warning', () => {
  const freshReport = () => new Date(Date.now() - 30_000).toISOString()
  const staleReport = () => new Date(Date.now() - 10 * 60_000).toISOString()

  it('shows a Client not running badge when an online PC reports its client is down', () => {
    renderCard({ ...onlinePc, service: { lastSeenAt: freshReport(), clientRunning: false } })
    expect(screen.getByText('Client not running')).not.toBeNull()
  })

  it('shows the badge for an offline PC whose service reported recently', () => {
    renderCard({
      ...onlinePc,
      status: 'offline',
      service: { lastSeenAt: freshReport(), clientRunning: true },
    })
    expect(screen.getByText('Client not running')).not.toBeNull()
  })

  it('shows no badge when the client is running on an online PC', () => {
    renderCard({ ...onlinePc, service: { lastSeenAt: freshReport(), clientRunning: true } })
    expect(screen.queryByText('Client not running')).toBeNull()
  })

  it('shows no badge for an offline PC whose service has been quiet for over 3 minutes', () => {
    renderCard({
      ...onlinePc,
      status: 'offline',
      service: { lastSeenAt: staleReport(), clientRunning: false },
    })
    expect(screen.queryByText('Client not running')).toBeNull()
  })
})

describe('PcCard details access', () => {
  it('lets the admin open the details of an offline PC', () => {
    const onOpenDetail = vi.fn()
    render(
      <TestProviders>
        <PcCard
          pc={{ ...onlinePc, status: 'offline' }}
          now={new Date()}
          isSelected={false}
          historyHref="/logs?pc=PC-01"
          onOpenDetail={onOpenDetail}
        />
      </TestProviders>,
    )
    const nameButton = screen.getByRole('button', { name: 'PC-01' })
    expect((nameButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(nameButton)
    expect(onOpenDetail).toHaveBeenCalledTimes(1)
  })
})
