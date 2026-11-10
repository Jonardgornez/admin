// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ClientUpdateDialog, type ClientUpdateTarget } from './client-update-dialog'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const target: ClientUpdateTarget = {
  pcIds: [1, 2],
  includesServerPc: false,
  release: {
    version: '0.20.0',
    sha256: 'abcdef0123456789'.repeat(4),
    sizeBytes: 75 * 1024 * 1024,
    uploadedAtUtc: '2026-11-10T09:30:00.000Z',
  },
}

function renderDialog(overrides: Partial<Parameters<typeof ClientUpdateDialog>[0]> = {}) {
  const props = {
    target,
    errorMessage: null,
    isBusy: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
  render(<ClientUpdateDialog {...props} />)
  return props
}

describe('ClientUpdateDialog', () => {
  it('asks to update the PCs to the version, and says when they install it', () => {
    renderDialog()
    const dialog = within(screen.getByRole('dialog', { name: 'Update 2 PCs to 0.20.0?' }))
    expect(dialog.getByText('Each PC installs it the next time nobody is using it.')).not.toBeNull()
  })

  it('shows the version, upload time and the first 12 characters of the hash', () => {
    renderDialog()
    expect(screen.getByText(/^v0\.20\.0 · Uploaded .+ · abcdef012345$/)).not.toBeNull()
  })

  it('uses the singular for one PC', () => {
    renderDialog({ target: { ...target, pcIds: [4] } })
    expect(screen.getByRole('dialog', { name: 'Update 1 PC to 0.20.0?' })).not.toBeNull()
  })

  it('says the selection includes the server PC when it does', () => {
    renderDialog({ target: { ...target, includesServerPc: true } })
    expect(screen.getByText('This includes the server PC.')).not.toBeNull()
  })

  it('does not mention the server PC when it is not selected', () => {
    renderDialog()
    expect(screen.queryByText('This includes the server PC.')).toBeNull()
  })

  it('shows a server error in the dialog so the admin can see why it did not start', () => {
    renderDialog({ errorMessage: 'The uploaded update changed. Check the version and try again.' })
    expect(screen.getByRole('alert').textContent).toBe(
      'The uploaded update changed. Check the version and try again.',
    )
  })

  it('calls onConfirm when Update is pressed', () => {
    const { onConfirm } = renderDialog()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Update' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel is pressed', () => {
    const { onCancel, onConfirm } = renderDialog()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('disables Update while the command is running', () => {
    renderDialog({ isBusy: true })
    const button = within(screen.getByRole('dialog')).getByRole('button', { name: 'Update' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('stays closed when there is no target', () => {
    renderDialog({ target: null })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
