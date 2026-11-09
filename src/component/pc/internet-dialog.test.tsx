// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { InternetDialog } from './internet-dialog'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

function renderDialog(overrides: Partial<Parameters<typeof InternetDialog>[0]> = {}) {
  const props = {
    action: { blocked: true, pcIds: [1, 2] },
    hiddenPcCount: 0,
    isBusy: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
  render(<InternetDialog {...props} />)
  return props
}

describe('InternetDialog', () => {
  it('asks before turning internet off and says the PCs keep reaching the server', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Turn off internet on 2 PCs?' })).toBeTruthy()
    expect(
      screen.getByText('They keep reaching the Lykantra server and the lab network.', { exact: false }),
    ).toBeTruthy()
  })

  it('asks before turning internet back on', () => {
    renderDialog({ action: { blocked: false, pcIds: [4] } })
    expect(
      screen.getByRole('heading', { name: 'Turn internet back on for 1 PC?' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Turn on' })).toHaveProperty('disabled', false)
  })

  it('confirms and cancels through its buttons', () => {
    const { onConfirm, onCancel } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('disables confirm while a change is running so it cannot be sent twice', () => {
    renderDialog({ isBusy: true })
    expect(screen.getByRole('button', { name: 'Turn off' })).toHaveProperty('disabled', true)
  })

  it('mentions PCs hidden by the search', () => {
    renderDialog({ hiddenPcCount: 1 })
    expect(screen.getByText('1 PC hidden by your search included.', { exact: false })).toBeTruthy()
  })
})
