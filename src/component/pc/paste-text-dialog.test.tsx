// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ALREADY_PASTING_MESSAGE, MAX_PASTE_LENGTH, PASTE_TOO_LONG_MESSAGE } from '../../lib/paste-text'
import { PASTE_TEXT_REQUIRED_MESSAGE } from '../../lib/paste-text-schema'
import { PasteProgress } from './paste-progress'
import { PasteTextDialog } from './paste-text-dialog'
import type { PasteTextResult } from './use-paste-text'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

type PasteHandler = (text: string) => PasteTextResult

function renderDialog({
  isSending = false,
  onPasteText = vi.fn<PasteHandler>(() => ({ success: true })),
}: { isSending?: boolean; onPasteText?: PasteHandler } = {}) {
  const onClose = vi.fn()
  render(
    <PasteTextDialog pcName="PC-01" isSending={isSending} onPasteText={onPasteText} onClose={onClose} />,
  )
  return {
    onPasteText,
    onClose,
    field: screen.getByLabelText<HTMLTextAreaElement>('Text to type'),
    typeButton: screen.getByRole<HTMLButtonElement>('button', { name: 'Type on PC' }),
  }
}

describe('PasteTextDialog', () => {
  it('has a labelled text field and a character counter', () => {
    const { field } = renderDialog()
    expect(screen.getByRole('heading', { name: 'Paste text on PC-01' })).toBeTruthy()
    expect(field.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('0/10,000 characters')).toBeTruthy()
  })

  it('warns that the text is shown in plain view', () => {
    renderDialog()
    expect(
      screen.getByText(
        "The text is typed where the PC's cursor is. It's shown in plain view here — take care with passwords.",
      ),
    ).toBeTruthy()
  })

  it('counts characters after normalization, so "\\r\\n" counts once', () => {
    const { field } = renderDialog()
    fireEvent.change(field, { target: { value: 'ab\r\ncd' } })
    expect(screen.getByText('5/10,000 characters')).toBeTruthy()
  })

  it('types the normalized text and closes', async () => {
    const { field, typeButton, onPasteText, onClose } = renderDialog()
    fireEvent.change(field, { target: { value: 'one\r\ntwo' } })
    fireEvent.click(typeButton)

    await vi.waitFor(() => expect(onPasteText).toHaveBeenCalledWith('one\ntwo'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks for text when the field is empty', async () => {
    const { typeButton, onPasteText, field } = renderDialog()
    fireEvent.click(typeButton)

    expect(await screen.findByText(PASTE_TEXT_REQUIRED_MESSAGE)).toBeTruthy()
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(onPasteText).not.toHaveBeenCalled()
  })

  it('refuses text over 10,000 characters and keeps it in the field', async () => {
    const { typeButton, onPasteText, field } = renderDialog()
    const text = 'a'.repeat(MAX_PASTE_LENGTH + 1)
    fireEvent.change(field, { target: { value: text } })
    fireEvent.click(typeButton)

    expect(await screen.findByText(PASTE_TOO_LONG_MESSAGE)).toBeTruthy()
    expect(field.value).toBe(text)
    expect(onPasteText).not.toHaveBeenCalled()
  })

  it('disables Type on PC and explains why while another paste is typing', () => {
    const { typeButton } = renderDialog({ isSending: true })
    expect(typeButton.disabled).toBe(true)
    expect(screen.getByText(ALREADY_PASTING_MESSAGE)).toBeTruthy()
  })

  it('shows a refusal from the sender and stays open', async () => {
    const onPasteText = vi.fn<PasteHandler>(() => ({ success: false, error: ALREADY_PASTING_MESSAGE }))
    const { field, typeButton, onClose } = renderDialog({ onPasteText })
    fireEvent.change(field, { target: { value: 'hi' } })
    fireEvent.click(typeButton)

    expect((await screen.findByRole('alert')).textContent).toContain(ALREADY_PASTING_MESSAGE)
    expect(onClose).not.toHaveBeenCalled()
    expect(field.value).toBe('hi')
  })

  it('closes from Cancel without typing', () => {
    const { onPasteText, onClose } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPasteText).not.toHaveBeenCalled()
  })
})

describe('PasteProgress', () => {
  it('shows the percentage and a progress bar, outside any live region', () => {
    render(<PasteProgress percent={42} onStop={vi.fn()} />)

    expect(screen.getByText('Typing… 42%').closest('[aria-live]')).toBeNull()
    expect(screen.getByRole('progressbar', { name: 'Typing progress' }).getAttribute('aria-valuenow')).toBe('42')
  })

  it('stops typing from the Stop button', () => {
    const onStop = vi.fn()
    render(<PasteProgress percent={10} onStop={onStop} />)

    fireEvent.click(screen.getByRole('button', { name: 'Stop typing' }))

    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
