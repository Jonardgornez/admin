// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_UPDATE_HINT } from '../../lib/internet'
import { TestProviders } from '../../test/test-providers'
import type { RegisteredPc } from '../../types'
import { PcDetailDialog } from './pc-detail-dialog'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

// The diagnostics section polls its own route, so these tests answer that route with a request that never finishes.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const onlinePc: RegisteredPc = { id: 1, name: 'PC-01', status: 'locked', lastSeen: 'Now' }

function renderDetail(pc: RegisteredPc) {
  render(
    <TestProviders>
      <PcDetailDialog pc={pc} onClose={vi.fn()} />
    </TestProviders>,
  )
}

describe('PcDetailDialog diagnostics', () => {
  it('has a Diagnostics section for the PC', () => {
    renderDetail(onlinePc)
    expect(screen.getByRole('heading', { name: 'Diagnostics' })).toBeTruthy()
  })

  it('requests the diagnostics of this PC when it opens', () => {
    renderDetail({ ...onlinePc, id: 12 })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/pcs/12/diagnostics', expect.anything())
  })
})

describe('PcDetailDialog internet', () => {
  it('has no button that turns internet on or off, since that moved to Restrictions', () => {
    renderDetail({ ...onlinePc, internetBlocked: true, internetBlockApplied: true })
    expect(screen.queryByRole('button', { name: 'Turn internet on' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Turn internet off' })).toBeNull()
  })

  it('shows the internet status of the PC', () => {
    renderDetail({ ...onlinePc, internetBlocked: true, internetBlockApplied: true })
    expect(screen.getByText('Internet')).toBeTruthy()
    expect(screen.getByText('No internet')).toBeTruthy()
  })

  it('shows the client update hint for a blocked online PC that has not reported', () => {
    renderDetail({ ...onlinePc, internetBlocked: true, internetBlockApplied: null })
    expect(screen.getByText(CLIENT_UPDATE_HINT)).toBeTruthy()
  })

  it('hides the client update hint once the PC has reported', () => {
    renderDetail({ ...onlinePc, internetBlocked: true, internetBlockApplied: true })
    expect(screen.queryByText(CLIENT_UPDATE_HINT)).toBeNull()
  })
})

describe('PcDetailDialog wallpaper', () => {
  it('shows a Wallpaper set badge when the PC has a wallpaper', () => {
    renderDetail({ ...onlinePc, wallpaperId: 4 })
    expect(screen.getByText('Wallpaper set')).toBeTruthy()
  })

  it('shows no wallpaper badge when the PC has none', () => {
    renderDetail({ ...onlinePc, wallpaperId: null })
    expect(screen.queryByText('Wallpaper set')).toBeNull()
  })
})
