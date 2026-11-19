// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { toRegisteredPcs } from '../../lib/pcs'
import { makeServerPc } from '../../test/screen-pc-fixtures'
import { TestProviders } from '../../test/test-providers'
import { ScreenGrid } from './screen-grid'

// No socket is opened in these tests.
vi.mock('../pc/screen-connection', () => ({
  openScreenConnection: () => ({ close: vi.fn(), send: vi.fn(() => false) }),
}))

// In the server's order, which is the dashboard's name order.
const PCS = toRegisteredPcs(
  [
    makeServerPc(1, 'PC-1', false),
    makeServerPc(2, 'PC-2', true),
    makeServerPc(3, 'PC-3', false),
    makeServerPc(10, 'PC-10', true),
  ],
  new Date('2026-11-10T10:00:00.000Z'),
)

function renderGrid(isOfflineShown: boolean, pcs = PCS) {
  render(
    <TestProviders>
      <ScreenGrid
        pcs={pcs}
        mode="notified"
        size="medium"
        isOfflineShown={isOfflineShown}
        emptyMessage="No PCs are online."
      />
    </TestProviders>,
  )
}

function tileNames(): string[] {
  const list = screen.getByRole('list', { name: 'PC screens' })
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.font-mono')?.textContent ?? '')
}

describe('ScreenGrid', () => {
  it('shows only the online PCs, in order, by default', () => {
    renderGrid(false)

    expect(tileNames()).toEqual(['PC-2', 'PC-10'])
    expect(screen.queryByText('Offline', { selector: 'span.aspect-video' })).toBeNull()
  })

  it('adds offline placeholders after the online PCs when they are shown', () => {
    renderGrid(true)

    expect(tileNames()).toEqual(['PC-2', 'PC-10', 'PC-1', 'PC-3'])
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('shows the empty message when no PC is online', () => {
    renderGrid(false, PCS.filter((pc) => pc.status === 'offline' || pc.status === 'shutdown'))

    expect(screen.getByText('No PCs are online.')).toBeTruthy()
  })
})
