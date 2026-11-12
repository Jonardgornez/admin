// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../lib/api'
import { PC_NUMBER_ERROR } from '../../lib/pc-name-schema'
import type { RenamedPc } from '../../lib/pcs-api'
import { TestProviders } from '../../test/test-providers'
import type { RegisteredPc } from '../../types'
import { RenamePcDialog } from './rename-pc-dialog'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

const pc: RegisteredPc = { id: 4, name: 'PC-1', status: 'locked', lastSeen: 'Now' }

type RenameHandler = (number: number) => Promise<ApiResult<RenamedPc>>

function renderDialog(
  onRename: RenameHandler = vi.fn<RenameHandler>(),
  renamedPc: RegisteredPc = pc,
) {
  const onClose = vi.fn()
  render(
    <TestProviders>
      <RenamePcDialog pc={renamedPc} onRename={onRename} onClose={onClose} />
    </TestProviders>,
  )
  return { onRename, onClose, field: screen.getByLabelText<HTMLInputElement>('PC number') }
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
}

describe('RenamePcDialog', () => {
  it('starts with the current number after the fixed PC- prefix', () => {
    const { field } = renderDialog()
    expect(field.value).toBe('1')
    expect(field.getAttribute('inputmode')).toBe('numeric')
    expect(screen.getByText('PC-')).toBeTruthy()
  })

  it('starts empty when the name has no PC number', () => {
    const { field } = renderDialog(undefined, { ...pc, name: 'LAB-A' })
    expect(field.value).toBe('')
  })

  it('sends the typed number', async () => {
    const onRename = vi.fn<RenameHandler>(() =>
      Promise.resolve({ success: true, data: { name: 'PC-9' } }),
    )
    const { field } = renderDialog(onRename)
    fireEvent.change(field, { target: { value: '9' } })
    submit()

    await waitFor(() => expect(onRename).toHaveBeenCalledWith(9))
  })

  it.each(['0', '1000000000', 'abc', '2.5'])('refuses %s under the field', async (value) => {
    const { onRename, field } = renderDialog()
    fireEvent.change(field, { target: { value } })
    submit()

    expect(await screen.findByText(PC_NUMBER_ERROR)).toBeTruthy()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(onRename).not.toHaveBeenCalled()
  })

  it('asks for a number when the field is empty', async () => {
    const { onRename, field } = renderDialog()
    fireEvent.change(field, { target: { value: '' } })
    submit()

    expect(await screen.findByText('Enter the PC number.')).toBeTruthy()
    expect(onRename).not.toHaveBeenCalled()
  })

  it.each([400, 409])('shows the server message under the field on %i', async (status) => {
    const message = 'PC-9 is already used by another PC.'
    const onRename = vi.fn<RenameHandler>(() =>
      Promise.resolve({ success: false, status, error: message }),
    )
    const { field } = renderDialog(onRename)
    fireEvent.change(field, { target: { value: '9' } })
    submit()

    expect(await screen.findByText(message)).toBeTruthy()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.value).toBe('9')
  })

  it('shows other failures in a banner', async () => {
    const onRename = vi.fn<RenameHandler>(() =>
      Promise.resolve({ success: false, status: 500, error: 'Server busy.' }),
    )
    const { field } = renderDialog(onRename)
    fireEvent.change(field, { target: { value: '9' } })
    submit()

    expect((await screen.findByRole('alert')).textContent).toContain('Server busy.')
  })

  it('closes from Cancel without renaming', () => {
    const { onRename, onClose } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onRename).not.toHaveBeenCalled()
  })
})
