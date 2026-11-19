// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTransfer } from '../../test/file-transfer-fixtures'
import { TestProviders } from '../../test/test-providers'
import type { FileTransfer } from '../../types'
import { FileTransferStatus } from './file-transfer-status'

const LATER = '2026-11-18T10:05:00Z'

function renderStatus(transfers: FileTransfer[]) {
  render(
    <TestProviders>
      <FileTransferStatus initialTransfers={transfers} />
    </TestProviders>,
  )
}

function getRow(pcName: string) {
  const row = screen.getByText(pcName).closest('li')
  if (!row) throw new Error(`No row for ${pcName}`)
  return within(row)
}

describe('FileTransferStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows each PC with its status as text, and a summary', () => {
    renderStatus([
      makeTransfer(1, { status: 'saved', savedAs: 'notes (2).pdf' }),
      makeTransfer(2, { status: 'failed', error: 'Not enough free space' }),
      makeTransfer(3),
    ])

    expect(screen.getByRole('status').textContent).toBe('Saved on 1 of 3 PCs.')
    expect(getRow('PC-1').getByText('Saved')).toBeTruthy()
    expect(getRow('PC-1').getByText('Saved as notes (2).pdf')).toBeTruthy()
    expect(getRow('PC-2').getByText('Failed')).toBeTruthy()
    expect(getRow('PC-2').getByText('Not enough free space')).toBeTruthy()
    expect(getRow('PC-3').getByText('Waiting for PC')).toBeTruthy()
  })

  it('offers Overwrite, Keep both and Skip for a file that already exists', () => {
    renderStatus([makeTransfer(1, { status: 'exists' })])

    const row = getRow('PC-1')
    expect(row.getByText('Already exists in Desktop\\Lykantra Share')).toBeTruthy()
    const choices = within(screen.getByRole('group', { name: 'Choice for PC-1' }))
    expect(choices.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Overwrite',
      'Keep both',
      'Skip',
    ])
    expect(screen.queryByRole('group', { name: /Apply to all/ })).toBeNull()
  })

  it('posts the choice for that PC only and shows the new status', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json({
          transfers: [makeTransfer(1, { status: 'applying', decision: 'keepBoth', updatedUtc: LATER })],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderStatus([makeTransfer(1, { status: 'exists' }), makeTransfer(2, { status: 'exists' })])

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Choice for PC-1' })).getByRole('button', {
        name: 'Keep both',
      }),
    )

    await waitFor(() => expect(getRow('PC-1').getByText('Applying choice')).toBeTruthy())
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ transferIds: [1], decision: 'keepBoth' })
  })

  it('offers Apply to all when two or more files already exist, and sends them together', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ transfers: [] })))
    vi.stubGlobal('fetch', fetchMock)
    renderStatus([
      makeTransfer(1, { status: 'exists' }),
      makeTransfer(2, { status: 'saved' }),
      makeTransfer(3, { status: 'exists' }),
    ])

    const applyAll = within(screen.getByRole('group', { name: 'Apply to all (2)' }))
    fireEvent.click(applyAll.getByRole('button', { name: 'Skip all' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ transferIds: [1, 3], decision: 'skip' })
  })

  it('disables every choice while a decision is posting', async () => {
    let finish: (response: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      ),
    )
    renderStatus([makeTransfer(1, { status: 'exists' }), makeTransfer(2, { status: 'exists' })])

    fireEvent.click(screen.getByRole('button', { name: 'Overwrite all' }))

    await waitFor(() =>
      expect(
        screen.getAllByRole('button').every((button) => (button as HTMLButtonElement).disabled),
      ).toBe(true),
    )
    finish(Response.json({ transfers: [] }))
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Overwrite all' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    )
  })

  it('shows the error when a decision fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ error: 'Server is busy.' }, { status: 500 }))),
    )
    renderStatus([makeTransfer(1, { status: 'exists' })])

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Server is busy.')
  })

  it('says why each PC is still waiting', () => {
    const longName = `${'quarterly-report-'.repeat(8)}final.pdf`
    renderStatus([
      makeTransfer(1, { waitingReason: 'offline' }),
      makeTransfer(2, { waitingReason: 'busy', busyWith: longName }),
      makeTransfer(3, { waitingReason: 'clientTooOld', pcClientVersion: '0.25.3' }),
      makeTransfer(4, { waitingReason: 'clientTooOld', pcClientVersion: null }),
    ])

    expect(
      getRow('PC-1').getByText('PC is offline. It gets the file if it comes back within 1 hour.'),
    ).toBeTruthy()
    expect(getRow('PC-2').getByText(longName).getAttribute('title')).toBe(longName)
    expect(getRow('PC-2').getByText(longName).closest('p')?.textContent).toBe(
      `PC is still receiving ${longName}.`,
    )
    expect(
      getRow('PC-3').getByText(
        'PC needs client 0.26.0 or newer (it has 0.25.3). Update it from the dashboard.',
      ),
    ).toBeTruthy()
    expect(
      getRow('PC-4').getByText(
        'PC needs client 0.26.0 or newer (it has an unknown version). Update it from the dashboard.',
      ),
    ).toBeTruthy()
  })

  it('shows a cancelled transfer with a Cancelled badge and no Cancel button', () => {
    renderStatus([makeTransfer(1, { status: 'cancelled' })])

    expect(getRow('PC-1').getByText('Cancelled')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Cancel/ })).toBeNull()
  })

  it('offers Cancel only on rows that can still change', () => {
    renderStatus([
      makeTransfer(1),
      makeTransfer(2, { status: 'downloading' }),
      makeTransfer(3, { status: 'exists' }),
      makeTransfer(4, { status: 'applying' }),
      makeTransfer(5, { status: 'saved' }),
      makeTransfer(6, { status: 'failed' }),
    ])

    for (const pcName of ['PC-1', 'PC-2', 'PC-3', 'PC-4']) {
      expect(screen.getByRole('button', { name: `Cancel sending to ${pcName}` })).toBeTruthy()
    }
    expect(screen.queryByRole('button', { name: 'Cancel sending to PC-5' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel sending to PC-6' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel all (4)' })).toBeTruthy()
  })

  it('cancels one PC without asking and shows it as cancelled', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json({ transfers: [makeTransfer(1, { status: 'cancelled', updatedUtc: LATER })] }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderStatus([makeTransfer(1)])

    expect(screen.queryByRole('button', { name: /Cancel all/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel sending to PC-1' }))

    await waitFor(() => expect(getRow('PC-1').getByText('Cancelled')).toBeTruthy())
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/pcs/files/transfers/cancel')
    expect(JSON.parse(init.body as string)).toEqual({ transferIds: [1] })
  })

  it('asks before cancelling all, and can be kept sending', () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    renderStatus([makeTransfer(1), makeTransfer(2, { status: 'downloading' })])

    fireEvent.click(screen.getByRole('button', { name: 'Cancel all (2)' }))
    const confirm = within(screen.getByRole('group', { name: 'Confirm cancel all' }))
    fireEvent.click(confirm.getByRole('button', { name: 'Keep sending' }))

    expect(screen.queryByRole('group', { name: 'Confirm cancel all' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels every PC that can still change once confirmed', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ transfers: [] })))
    vi.stubGlobal('fetch', fetchMock)
    renderStatus([
      makeTransfer(1),
      makeTransfer(2, { status: 'saved' }),
      makeTransfer(3, { status: 'exists' }),
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Cancel all (2)' }))
    const confirm = within(screen.getByRole('group', { name: 'Confirm cancel all' }))
    fireEvent.click(confirm.getByRole('button', { name: 'Cancel all (2)' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ transferIds: [1, 3] })
  })

  it('disables the Cancel buttons while a cancel is posting', async () => {
    let finish: (response: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      ),
    )
    renderStatus([makeTransfer(1), makeTransfer(2)])

    fireEvent.click(screen.getByRole('button', { name: 'Cancel sending to PC-1' }))

    await waitFor(() =>
      expect(
        screen.getAllByRole('button').every((button) => (button as HTMLButtonElement).disabled),
      ).toBe(true),
    )
    finish(Response.json({ transfers: [] }))
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Cancel sending to PC-1' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )
  })
})
