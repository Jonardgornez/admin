// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScreenStatusBadge } from './screen-status-badge'

describe('ScreenStatusBadge', () => {
  it('labels a streamed protected screen as text', () => {
    render(<ScreenStatusBadge status={{ kind: 'secure' }} />)

    expect(screen.getByText('PC reports a protected screen')).toBeTruthy()
  })

  it('shows Live, not the protected-screen label, once the screen is live again', () => {
    const { rerender } = render(<ScreenStatusBadge status={{ kind: 'secure' }} />)

    rerender(<ScreenStatusBadge status={{ kind: 'live' }} />)

    expect(screen.getByText('Live')).toBeTruthy()
    expect(screen.queryByText('PC reports a protected screen')).toBeNull()
  })

  it('still labels the paused fallback as Paused', () => {
    render(<ScreenStatusBadge status={{ kind: 'paused' }} />)

    expect(screen.getByText('Paused')).toBeTruthy()
  })
})
