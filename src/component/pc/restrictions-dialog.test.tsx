// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../lib/api'
import type { InternetResult } from '../../lib/internet-api'
import type { RegisteredPc } from '../../types'
import { RestrictionsDialog } from './restrictions-dialog'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

function makePc(id: number, overrides: Partial<RegisteredPc> = {}): RegisteredPc {
  return { id, name: `PC-${id}`, status: 'locked', lastSeen: 'Now', ...overrides }
}

function getInternetCheckbox() {
  return screen.getByRole('checkbox', { name: 'Block internet' }) as HTMLInputElement
}

function renderDialog(
  targetPcs: RegisteredPc[],
  onApplyInternet: (pcIds: number[], blocked: boolean) => Promise<ApiResult<InternetResult[]> | null> = vi.fn(
    async () => null,
  ),
) {
  const onClose = vi.fn()
  render(<RestrictionsDialog targetPcs={targetPcs} onApplyInternet={onApplyInternet} onClose={onClose} />)
  return { onApplyInternet, onClose }
}

describe('RestrictionsDialog internet choice', () => {
  it('checks Block internet when every target PC is blocked', () => {
    renderDialog([makePc(1, { internetBlocked: true }), makePc(2, { internetBlocked: true })])
    expect(getInternetCheckbox().checked).toBe(true)
    expect(getInternetCheckbox().indeterminate).toBe(false)
  })

  it('leaves Block internet unchecked when no target PC is blocked', () => {
    renderDialog([makePc(1), makePc(2, { internetBlocked: false })])
    expect(getInternetCheckbox().checked).toBe(false)
    expect(getInternetCheckbox().indeterminate).toBe(false)
  })

  it('shows Block internet as indeterminate when some target PCs are blocked', () => {
    renderDialog([makePc(1), makePc(2, { internetBlocked: true })])
    expect(getInternetCheckbox().checked).toBe(false)
    expect(getInternetCheckbox().indeterminate).toBe(true)
  })

  it('checks the box when it is clicked from indeterminate', () => {
    renderDialog([makePc(1), makePc(2, { internetBlocked: true })])
    fireEvent.click(getInternetCheckbox())
    expect(getInternetCheckbox().checked).toBe(true)
    expect(getInternetCheckbox().indeterminate).toBe(false)
  })

  it('explains what a blocked PC can still reach', () => {
    renderDialog([makePc(1)])
    expect(
      screen.getByText('Blocked PCs can still reach the Lykantra server and the lab network.'),
    ).toBeTruthy()
    expect(getInternetCheckbox().getAttribute('aria-describedby')).toBeTruthy()
  })

  it('leaves the server PC out of the targets and says its internet stays on', () => {
    renderDialog([makePc(1, { isServerPc: true }), makePc(2)])
    expect(screen.getByText('PC-2')).toBeTruthy()
    expect(screen.queryByText('PC-1')).toBeNull()
    expect(screen.getByText('This PC runs the server, so its internet stays on.')).toBeTruthy()
  })

  it('does not show the server note when no server PC was selected', () => {
    renderDialog([makePc(2)])
    expect(screen.queryByText('This PC runs the server, so its internet stays on.')).toBeNull()
  })
})

describe('RestrictionsDialog restriction options', () => {
  it('keeps the policy and drive options visible but disabled', () => {
    renderDialog([makePc(1)])
    expect(screen.getByRole('checkbox', { name: 'Disable Access to Task Manager' })).toHaveProperty('disabled', true)
    for (const driveCheckbox of screen.getAllByRole('checkbox', { name: 'A' })) {
      expect(driveCheckbox).toHaveProperty('disabled', true)
    }
    expect(screen.getByRole('checkbox', { name: 'Apply without restarting computer' })).toHaveProperty('disabled', true)
  })

  it('shows the restrictions the target PCs already have, read-only', () => {
    renderDialog([
      makePc(1, { restrictions: { policies: ['task-manager'], hiddenDrives: [], disabledDrives: [] } }),
    ])
    expect(screen.getByRole('checkbox', { name: 'Disable Access to Task Manager' })).toHaveProperty('checked', true)
  })

  it('says the restrictions are not available yet', () => {
    renderDialog([makePc(1)])
    expect(screen.getByText("These restrictions aren't available yet.")).toBeTruthy()
  })
})

describe('RestrictionsDialog OK', () => {
  it('closes without calling the API when the internet choice is unchanged', () => {
    const { onApplyInternet, onClose } = renderDialog([makePc(1, { internetBlocked: true })])
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApplyInternet).not.toHaveBeenCalled()
  })

  it('closes without calling the API when the choice is still indeterminate', () => {
    const { onApplyInternet, onClose } = renderDialog([makePc(1), makePc(2, { internetBlocked: true })])
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApplyInternet).not.toHaveBeenCalled()
  })

  it('closes without calling the API when a change is undone', () => {
    const { onApplyInternet, onClose } = renderDialog([makePc(1)])
    fireEvent.click(getInternetCheckbox())
    fireEvent.click(getInternetCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApplyInternet).not.toHaveBeenCalled()
  })

  it('blocks only the PCs that are not blocked yet', async () => {
    const onApplyInternet = vi.fn(async () => null)
    const { onClose } = renderDialog(
      [makePc(1), makePc(2, { internetBlocked: true }), makePc(3, { isServerPc: true })],
      onApplyInternet,
    )
    fireEvent.click(getInternetCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(onApplyInternet).toHaveBeenCalledWith([1], true))
    expect(onApplyInternet).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('turns internet back on only for the PCs that are blocked', async () => {
    const onApplyInternet = vi.fn(async () => null)
    renderDialog([makePc(1), makePc(2, { internetBlocked: true }), makePc(3, { internetBlocked: true })], onApplyInternet)
    fireEvent.click(getInternetCheckbox())
    fireEvent.click(getInternetCheckbox())
    expect(getInternetCheckbox().checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(onApplyInternet).toHaveBeenCalledWith([2, 3], false))
  })

  it('sends the unblock for every blocked PC when unchecking a fully blocked selection', async () => {
    const onApplyInternet = vi.fn(async () => null)
    renderDialog([makePc(1, { internetBlocked: true }), makePc(2, { internetBlocked: true })], onApplyInternet)
    fireEvent.click(getInternetCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(onApplyInternet).toHaveBeenCalledWith([1, 2], false))
  })

  it('keeps the dialog open and shows the error when the change fails', async () => {
    const onApplyInternet = vi.fn(async () => ({
      success: false as const,
      status: 500,
      error: 'The server could not reach the PCs.',
    }))
    const { onClose } = renderDialog([makePc(1)], onApplyInternet)
    fireEvent.click(getInternetCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'The server could not reach the PCs.',
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'OK' })).toHaveProperty('disabled', false)
  })

  it('disables OK and the internet box while the change is running', async () => {
    let finishChange: (result: ApiResult<InternetResult[]> | null) => void = () => undefined
    const onApplyInternet = vi.fn(
      () => new Promise<ApiResult<InternetResult[]> | null>((resolve) => (finishChange = resolve)),
    )
    renderDialog([makePc(1)], onApplyInternet)
    fireEvent.click(getInternetCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'OK' })).toHaveProperty('disabled', true))
    expect(getInternetCheckbox()).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(onApplyInternet).toHaveBeenCalledTimes(1)
    finishChange(null)
    await waitFor(() => expect(screen.getByRole('button', { name: 'OK' })).toHaveProperty('disabled', false))
  })

  it('closes through Cancel without calling the API', () => {
    const { onApplyInternet, onClose } = renderDialog([makePc(1)])
    fireEvent.click(getInternetCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApplyInternet).not.toHaveBeenCalled()
  })
})
