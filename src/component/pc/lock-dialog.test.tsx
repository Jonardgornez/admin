// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { RegisteredPc } from '../../types'
import { LockDialog } from './lock-dialog'
import type { LockAction } from '../../lib/pc-lock-action'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const DEFAULT_MESSAGE = 'This computer has been locked by the administrator.'
const MESSAGE_LABEL = 'Message on the PC (optional)'
const pc: RegisteredPc = { id: 3, name: 'PC-03', status: 'in-use', lastSeen: 'Now' }
const singleLock: LockAction = { kind: 'lock', pc }
const bulkLock: LockAction = { kind: 'lock', pcIds: [1, 2, 3] }
const bulkUnlock: LockAction = { kind: 'unlock', pcIds: [1, 2] }

function renderDialog(action: LockAction, overrides: { isBusy?: boolean; hiddenPcCount?: number } = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <LockDialog
      action={action}
      defaultMessage={DEFAULT_MESSAGE}
      hiddenPcCount={overrides.hiddenPcCount ?? 0}
      isBusy={overrides.isBusy ?? false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel }
}

function lockButton() {
  return screen.getByRole('button', { name: 'Lock' })
}

describe('LockDialog', () => {
  it('asks for an optional message, with the default as the placeholder', () => {
    renderDialog(singleLock)

    expect(screen.getByRole('heading', { name: 'Lock 1 PC?' })).not.toBeNull()
    const field = screen.getByLabelText(MESSAGE_LABEL)
    expect(field.getAttribute('placeholder')).toBe(DEFAULT_MESSAGE)
    expect(screen.getByText('0/200')).not.toBeNull()
    expect(lockButton().hasAttribute('disabled')).toBe(false)
  })

  it('sends null when the message is left empty, so the PC shows the default', () => {
    const { onConfirm } = renderDialog(singleLock)

    fireEvent.click(lockButton())

    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('sends null when the message is only spaces', () => {
    const { onConfirm } = renderDialog(singleLock)

    fireEvent.change(screen.getByLabelText(MESSAGE_LABEL), { target: { value: '   ' } })
    fireEvent.click(lockButton())

    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('sends the typed message, trimmed', () => {
    const { onConfirm } = renderDialog(singleLock)

    fireEvent.change(screen.getByLabelText(MESSAGE_LABEL), {
      target: { value: '  Back at 10:00.  ' },
    })
    fireEvent.click(lockButton())

    expect(onConfirm).toHaveBeenCalledWith('Back at 10:00.')
  })

  it('updates the counter as the admin types', () => {
    renderDialog(singleLock)

    fireEvent.change(screen.getByLabelText(MESSAGE_LABEL), { target: { value: 'Gone to lunch' } })

    expect(screen.getByText('13/200')).not.toBeNull()
  })

  it('accepts 200 characters', () => {
    const { onConfirm } = renderDialog(singleLock)

    fireEvent.change(screen.getByLabelText(MESSAGE_LABEL), { target: { value: 'a'.repeat(200) } })
    fireEvent.click(lockButton())

    expect(onConfirm).toHaveBeenCalledWith('a'.repeat(200))
  })

  it('shows the length message and disables Lock for 201 characters', () => {
    const { onConfirm } = renderDialog(singleLock)

    fireEvent.change(screen.getByLabelText(MESSAGE_LABEL), { target: { value: 'a'.repeat(201) } })

    expect(screen.getByText('The message must be 200 characters or fewer.')).not.toBeNull()
    expect(screen.getByLabelText(MESSAGE_LABEL).getAttribute('aria-invalid')).toBe('true')
    expect(lockButton().hasAttribute('disabled')).toBe(true)
    fireEvent.click(lockButton())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('shows the character message and disables Lock for a line break', () => {
    renderDialog(singleLock)

    fireEvent.change(screen.getByLabelText(MESSAGE_LABEL), { target: { value: 'One\ntwo' } })

    expect(
      screen.getByText("The message can't contain line breaks or control characters."),
    ).not.toBeNull()
    expect(lockButton().hasAttribute('disabled')).toBe(true)
  })

  it('asks for the message when several PCs are locked, and sends it once', () => {
    const { onConfirm } = renderDialog(bulkLock)

    expect(screen.getByRole('heading', { name: 'Lock 3 PCs?' })).not.toBeNull()
    fireEvent.change(screen.getByLabelText(MESSAGE_LABEL), { target: { value: 'Class is over.' } })
    fireEvent.click(lockButton())

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('Class is over.')
  })

  it('does not ask for a message when PCs are unlocked', () => {
    const { onConfirm } = renderDialog(bulkUnlock)

    expect(screen.getByRole('heading', { name: 'Unlock 2 PCs?' })).not.toBeNull()
    expect(screen.queryByLabelText(MESSAGE_LABEL)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(onConfirm).toHaveBeenCalledWith(null)
  })

  it('disables Lock while the command is running', () => {
    renderDialog(bulkLock, { isBusy: true })

    expect(lockButton().hasAttribute('disabled')).toBe(true)
  })

  it('says how many hidden PCs are included', () => {
    renderDialog(bulkLock, { hiddenPcCount: 2 })

    expect(screen.getByText(/2 PCs hidden by your search included\./)).not.toBeNull()
  })

  it('calls onCancel from the Cancel button', () => {
    const { onCancel, onConfirm } = renderDialog(singleLock)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
