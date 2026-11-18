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
})
