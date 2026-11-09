// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Pc } from '../../types'
import { InternetBadge } from './pc-status-badge'

const onlinePc: Pc = { name: 'PC-01', status: 'locked', lastSeen: 'Now' }
const offlinePc: Pc = { name: 'PC-02', status: 'offline', lastSeen: '09:15' }

describe('InternetBadge', () => {
  it('says no internet once the PC confirms the block', () => {
    render(<InternetBadge pc={{ ...onlinePc, internetBlocked: true, internetBlockApplied: true }} />)
    expect(screen.getByText('No internet')).toBeTruthy()
  })

  it('says internet is turning off while an online PC has not confirmed', () => {
    render(<InternetBadge pc={{ ...onlinePc, internetBlocked: true, internetBlockApplied: null }} />)
    expect(screen.getByText('Turning internet off…')).toBeTruthy()
  })

  it('says internet is turning on while an unblock is still applied', () => {
    render(<InternetBadge pc={{ ...onlinePc, internetBlocked: false, internetBlockApplied: true }} />)
    expect(screen.getByText('Turning internet on…')).toBeTruthy()
  })

  it('shows nothing for a PC with internet on', () => {
    const { container } = render(<InternetBadge pc={onlinePc} />)
    expect(container.textContent).toBe('')
  })

  it('shows nothing for an offline PC that has not confirmed the block', () => {
    const { container } = render(
      <InternetBadge pc={{ ...offlinePc, internetBlocked: true, internetBlockApplied: null }} />,
    )
    expect(container.textContent).toBe('')
  })
})
