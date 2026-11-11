// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Pc } from '../../types'
import { AddTimeDialog } from './add-time-dialog'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const TIME_OUT_OPTION = 'Time out – no time left'
const inUsePc: Pc = { name: 'PC-01', status: 'in-use', user: 'student1', lastSeen: 'Now' }

function renderDialog(pc: Pc) {
  const onConfirm = vi.fn()
  const onTimeOut = vi.fn()
  render(
    <AddTimeDialog
      pc={pc}
      isBusy={false}
      onConfirm={onConfirm}
      onTimeOut={onTimeOut}
      onCancel={vi.fn()}
    />,
  )
  return { onConfirm, onTimeOut }
}

describe('AddTimeDialog', () => {
  it('titles the dialog with the PC name and shows its time left', () => {
    renderDialog({ ...inUsePc, isOpenTime: true })
    expect(screen.getByRole('heading', { name: 'Edit time for PC-01' })).toBeTruthy()
    expect(screen.getByText('Time left: Open time')).toBeTruthy()
  })

  it('confirms the time added to the PC', () => {
    const { onConfirm } = renderDialog(inUsePc)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'time-limit', minutes: 30 })
  })

  it('names the session owner in the Time out warning', () => {
    const { onTimeOut } = renderDialog(inUsePc)
    fireEvent.click(screen.getByRole('radio', { name: TIME_OUT_OPTION }))
    expect(screen.getByRole('status').textContent).toBe(
      "student1's session ends now and PC-01 returns to the login screen. Unsaved work may be lost.",
    )
    fireEvent.click(screen.getByRole('button', { name: 'Time out' }))
    expect(onTimeOut).toHaveBeenCalledTimes(1)
  })

  it('does not offer Time out for a locked PC, and says its time stays paused', () => {
    renderDialog({ name: 'PC-01', status: 'frozen', timeUsed: '00:30', lastSeen: 'Now' })
    expect(screen.queryByRole('radio', { name: TIME_OUT_OPTION })).toBeNull()
    expect(screen.getByText('The time stays paused until you unlock this PC.')).toBeTruthy()
  })
})
