// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { RegisteredPc } from '../../types'
import { BulkTimeDialog } from './bulk-time-dialog'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const TIME_OUT_OPTION = 'Time out – end all selected sessions now'
const LOCKED_NOTE = 'Locked PCs keep their time paused until you unlock them.'
const inUsePc: RegisteredPc = { id: 1, name: 'PC-01', status: 'in-use', lastSeen: 'Now' }
const otherInUsePc: RegisteredPc = { id: 2, name: 'PC-02', status: 'in-use', lastSeen: 'Now' }
const lockedPc: RegisteredPc = {
  id: 3,
  name: 'PC-03',
  status: 'frozen',
  timeUsed: '00:30',
  lastSeen: 'Now',
}

function renderDialog(pcs: RegisteredPc[], isBusy = false) {
  const onConfirm = vi.fn()
  const onTimeOut = vi.fn()
  const onCancel = vi.fn()
  render(
    <BulkTimeDialog
      pcs={pcs}
      isBusy={isBusy}
      onConfirm={onConfirm}
      onTimeOut={onTimeOut}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onTimeOut, onCancel }
}

describe('BulkTimeDialog', () => {
  it('titles the dialog with the number of PCs and shows no per-PC time left', () => {
    renderDialog([inUsePc, otherInUsePc])
    expect(screen.getByRole('heading', { name: 'Edit time for 2 PCs' })).toBeTruthy()
    expect(screen.queryByText(/Time left/)).toBeNull()
  })

  it('adds 30 minutes by default and confirms the choice', () => {
    const { onConfirm, onTimeOut } = renderDialog([inUsePc, otherInUsePc])
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'time-limit', minutes: 30 })
    expect(onTimeOut).not.toHaveBeenCalled()
  })

  it('confirms open time for every selected PC', () => {
    const { onConfirm } = renderDialog([inUsePc, otherInUsePc])
    fireEvent.click(screen.getByRole('radio', { name: 'Open time – no time limit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'open-time' })
  })

  it('does not confirm an amount that is not at least one minute', () => {
    const { onConfirm } = renderDialog([inUsePc])
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('disables Confirm while a bulk command is running', () => {
    renderDialog([inUsePc], true)
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', true)
  })

  it('offers Time out when at least one selected PC is in use', () => {
    renderDialog([inUsePc, lockedPc])
    expect(screen.getByRole('radio', { name: TIME_OUT_OPTION })).toBeTruthy()
  })

  it('hides Time out when no selected PC is in use', () => {
    renderDialog([lockedPc])
    expect(screen.queryByRole('radio', { name: TIME_OUT_OPTION })).toBeNull()
  })

  it('warns about the sessions ending before a Time out is confirmed', () => {
    const { onConfirm, onTimeOut } = renderDialog([inUsePc, otherInUsePc, lockedPc])
    fireEvent.click(screen.getByRole('radio', { name: TIME_OUT_OPTION }))
    expect(screen.getByRole('status').textContent).toBe(
      '2 PCs in use will end now and return to the login screen. Unsaved work may be lost. Locked PCs are skipped.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Time out' }))
    expect(onTimeOut).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('notes that locked PCs keep their time paused', () => {
    renderDialog([inUsePc, lockedPc])
    expect(screen.getByText(LOCKED_NOTE)).toBeTruthy()
  })

  it('does not show the locked note when no selected PC is locked', () => {
    renderDialog([inUsePc, otherInUsePc])
    expect(screen.queryByText(LOCKED_NOTE)).toBeNull()
  })
})
