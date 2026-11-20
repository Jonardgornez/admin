// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../lib/api'
import type { InternetResult } from '../../lib/internet-api'
import type { BulkCommandResult } from '../../lib/pcs-api'
import type { PcRestrictions, PcRestrictionsChange, RegisteredPc } from '../../types'
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

function getSwitchingCheckbox() {
  return screen.getByRole('checkbox', { name: 'Disable Fast User Switch' }) as HTMLInputElement
}

function getTaskManagerCheckbox() {
  return screen.getByRole('checkbox', { name: 'Disable Access to Task Manager' }) as HTMLInputElement
}

type ApplyInternet = (pcIds: number[], blocked: boolean) => Promise<ApiResult<InternetResult[]> | null>
type ApplyRestriction = (pcIds: number[], disabled: boolean) => Promise<ApiResult<BulkCommandResult> | null>
type ApplyRestrictions = (
  pcIds: number[],
  change: PcRestrictionsChange,
) => Promise<ApiResult<BulkCommandResult> | null>

function renderDialog(
  targetPcs: RegisteredPc[],
  onApplyInternet: ApplyInternet = vi.fn(async () => null),
  onApplyFastUserSwitching: ApplyRestriction = vi.fn(async () => null),
  onApplyTaskManager: ApplyRestriction = vi.fn(async () => null),
  onApplyRestrictions: ApplyRestrictions = vi.fn(async () => null),
) {
  const onClose = vi.fn()
  const view = render(
    <RestrictionsDialog
      targetPcs={targetPcs}
      onApplyInternet={onApplyInternet}
      onApplyFastUserSwitching={onApplyFastUserSwitching}
      onApplyTaskManager={onApplyTaskManager}
      onApplyRestrictions={onApplyRestrictions}
      onClose={onClose}
    />,
  )
  return {
    onApplyInternet,
    onApplyFastUserSwitching,
    onApplyTaskManager,
    onApplyRestrictions,
    onClose,
    unmount: view.unmount,
  }
}

const affected = (count: number): ApiResult<BulkCommandResult> => ({
  success: true,
  data: { affected: count },
})

describe('RestrictionsDialog Fast User Switching', () => {
  it('shows the current choice: checked, unchecked or mixed', () => {
    const { unmount } = renderDialog([makePc(1, { fastUserSwitchingDisabled: true })])
    expect(getSwitchingCheckbox().checked).toBe(true)
    unmount()

    renderDialog([makePc(1), makePc(2, { fastUserSwitchingDisabled: true })])
    expect(getSwitchingCheckbox().checked).toBe(false)
    expect(getSwitchingCheckbox().indeterminate).toBe(true)
  })

  it('is a working checkbox and is no longer in the read-only policy list', () => {
    renderDialog([makePc(1)])
    expect(getSwitchingCheckbox().disabled).toBe(false)
    expect(screen.getAllByRole('checkbox', { name: /Fast User Switch/ })).toHaveLength(1)
  })

  it('turns it off only for PCs that still allow it, and closes when done', async () => {
    const onApplyFastUserSwitching = vi.fn(async () => affected(1))
    const { onApplyInternet, onClose } = renderDialog(
      [makePc(1), makePc(2, { fastUserSwitchingDisabled: true }), makePc(3, { isServerPc: true })],
      undefined,
      onApplyFastUserSwitching,
    )

    fireEvent.click(getSwitchingCheckbox())
    fireEvent.click(getSwitchingCheckbox())
    fireEvent.click(getSwitchingCheckbox())
    expect(getSwitchingCheckbox().checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onApplyFastUserSwitching).toHaveBeenCalledWith([1], true)
    expect(onApplyInternet).not.toHaveBeenCalled()
  })

  it('allows it again for every PC that has it off', async () => {
    const onApplyFastUserSwitching = vi.fn(async () => affected(2))
    renderDialog(
      [makePc(1, { fastUserSwitchingDisabled: true }), makePc(2, { fastUserSwitchingDisabled: true })],
      undefined,
      onApplyFastUserSwitching,
    )

    fireEvent.click(getSwitchingCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onApplyFastUserSwitching).toHaveBeenCalledWith([1, 2], false))
  })

  it('applies internet first and then Fast User Switching', async () => {
    const calls: string[] = []
    const onApplyInternet = vi.fn(async () => {
      calls.push('internet')
      return { success: true as const, data: [] }
    })
    const onApplyFastUserSwitching = vi.fn(async () => {
      calls.push('switching')
      return affected(1)
    })
    const { onClose } = renderDialog([makePc(1)], onApplyInternet, onApplyFastUserSwitching)

    fireEvent.click(getInternetCheckbox())
    fireEvent.click(getSwitchingCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(calls).toEqual(['internet', 'switching'])
  })

  it('stops after a failed internet change and keeps the dialog open', async () => {
    const onApplyInternet = vi.fn(async () => ({ success: false as const, status: 500, error: 'Server down.' }))
    const onApplyFastUserSwitching = vi.fn(async () => affected(1))
    const { onClose } = renderDialog([makePc(1)], onApplyInternet, onApplyFastUserSwitching)

    fireEvent.click(getInternetCheckbox())
    fireEvent.click(getSwitchingCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Server down.')
    expect(onApplyFastUserSwitching).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the error when the Fast User Switching change fails', async () => {
    const onApplyFastUserSwitching = vi.fn(async () => ({
      success: false as const,
      status: 400,
      error: 'Invalid request.',
    }))
    const { onClose } = renderDialog([makePc(1)], undefined, onApplyFastUserSwitching)

    fireEvent.click(getSwitchingCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid request.')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('RestrictionsDialog Task Manager', () => {
  it('shows the current choice: checked, unchecked or mixed', () => {
    const { unmount } = renderDialog([makePc(1, { taskManagerDisabled: true })])
    expect(getTaskManagerCheckbox().checked).toBe(true)
    unmount()

    renderDialog([makePc(1), makePc(2, { taskManagerDisabled: true })])
    expect(getTaskManagerCheckbox().checked).toBe(false)
    expect(getTaskManagerCheckbox().indeterminate).toBe(true)
  })

  it('is a working checkbox in the Policies list, shown once', () => {
    renderDialog([makePc(1)])
    expect(getTaskManagerCheckbox().disabled).toBe(false)
    expect(screen.getAllByRole('checkbox', { name: /Task Manager/ })).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Policies' }).contains(getTaskManagerCheckbox())).toBe(true)
  })

  it('turns it off only for PCs that still allow it, leaving the server PC out', async () => {
    const onApplyTaskManager = vi.fn(async () => affected(1))
    const { onApplyInternet, onApplyFastUserSwitching, onClose } = renderDialog(
      [makePc(1), makePc(2, { taskManagerDisabled: true }), makePc(3, { isServerPc: true })],
      undefined,
      undefined,
      onApplyTaskManager,
    )

    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(getTaskManagerCheckbox())
    expect(getTaskManagerCheckbox().checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onApplyTaskManager).toHaveBeenCalledWith([1], true)
    expect(onApplyInternet).not.toHaveBeenCalled()
    expect(onApplyFastUserSwitching).not.toHaveBeenCalled()
  })

  it('allows it again for every PC that has it off', async () => {
    const onApplyTaskManager = vi.fn(async () => affected(2))
    renderDialog(
      [makePc(1, { taskManagerDisabled: true }), makePc(2, { taskManagerDisabled: true })],
      undefined,
      undefined,
      onApplyTaskManager,
    )

    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onApplyTaskManager).toHaveBeenCalledWith([1, 2], false))
  })

  it('applies internet, then Fast User Switching, then Task Manager', async () => {
    const calls: string[] = []
    const onApplyInternet = vi.fn(async () => {
      calls.push('internet')
      return { success: true as const, data: [] }
    })
    const onApplyFastUserSwitching = vi.fn(async () => {
      calls.push('switching')
      return affected(1)
    })
    const onApplyTaskManager = vi.fn(async () => {
      calls.push('task-manager')
      return affected(1)
    })
    const { onClose } = renderDialog([makePc(1)], onApplyInternet, onApplyFastUserSwitching, onApplyTaskManager)

    fireEvent.click(getInternetCheckbox())
    fireEvent.click(getSwitchingCheckbox())
    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(calls).toEqual(['internet', 'switching', 'task-manager'])
  })

  it('stops after a failed Fast User Switching change and keeps the dialog open', async () => {
    const onApplyFastUserSwitching = vi.fn(async () => ({
      success: false as const,
      status: 500,
      error: 'Server down.',
    }))
    const onApplyTaskManager = vi.fn(async () => affected(1))
    const { onClose } = renderDialog([makePc(1)], undefined, onApplyFastUserSwitching, onApplyTaskManager)

    fireEvent.click(getSwitchingCheckbox())
    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Server down.')
    expect(onApplyTaskManager).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the error when the Task Manager change fails', async () => {
    const onApplyTaskManager = vi.fn(async () => ({
      success: false as const,
      status: 400,
      error: 'Invalid request.',
    }))
    const { onClose } = renderDialog([makePc(1)], undefined, undefined, onApplyTaskManager)

    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid request.')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables the checkbox while the change is running', async () => {
    let finishChange: (result: ApiResult<BulkCommandResult> | null) => void = () => undefined
    const onApplyTaskManager = vi.fn(
      () => new Promise<ApiResult<BulkCommandResult> | null>((resolve) => (finishChange = resolve)),
    )
    renderDialog([makePc(1)], undefined, undefined, onApplyTaskManager)

    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(getTaskManagerCheckbox().disabled).toBe(true))
    finishChange(null)
    await waitFor(() => expect(getTaskManagerCheckbox().disabled).toBe(false))
  })
})

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
      screen.getByText('Block internet: PCs can still reach the Lykantra server and the lab network.'),
    ).toBeTruthy()
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

function makeRestrictedPc(id: number, restrictions: Partial<PcRestrictions>): RegisteredPc {
  return makePc(id, { restrictions: { policies: [], hiddenDrives: [], disabledDrives: [], ...restrictions } })
}

function getCheckbox(name: string | RegExp) {
  return screen.getByRole('checkbox', { name }) as HTMLInputElement
}

function getDriveCheckbox(group: 'Hide Drives (*)' | 'Disable Drives (*)', letter: string) {
  return within(screen.getByRole('group', { name: group })).getByRole('checkbox', {
    name: letter,
  }) as HTMLInputElement
}

function renderListDialog(
  targetPcs: RegisteredPc[],
  onApplyRestrictions: ApplyRestrictions = vi.fn(async () => affected(1)),
) {
  return renderDialog(targetPcs, undefined, undefined, undefined, onApplyRestrictions)
}

describe('RestrictionsDialog policies and drives', () => {
  it('shows each item as checked, unchecked or mixed across the PCs', () => {
    renderListDialog([
      makeRestrictedPc(1, { policies: ['registry-editor', 'run-command'], hiddenDrives: ['D'] }),
      makeRestrictedPc(2, { policies: ['registry-editor'], hiddenDrives: ['D'], disabledDrives: ['E'] }),
    ])
    expect(getCheckbox('Disable Access to Registry Editor').checked).toBe(true)
    expect(getCheckbox('Disable Run Command (*)').indeterminate).toBe(true)
    expect(getCheckbox('Disable Command Prompt').checked).toBe(false)
    expect(getCheckbox('Disable Command Prompt').indeterminate).toBe(false)
    expect(getDriveCheckbox('Hide Drives (*)', 'D').checked).toBe(true)
    expect(getDriveCheckbox('Disable Drives (*)', 'E').indeterminate).toBe(true)
  })

  it('lists internet, Fast User Switch and Task Manager with the other policies, and file/folder protection disabled', () => {
    renderListDialog([makePc(1)])
    const grid = within(screen.getByRole('group', { name: 'Policies' }))
    expect(grid.getByRole('checkbox', { name: 'Block internet' })).toBeTruthy()
    expect(grid.getByRole('checkbox', { name: /Task Manager/ })).toBeTruthy()
    expect(grid.getByRole('checkbox', { name: /Fast User Switch/ })).toBeTruthy()
    const protection = getCheckbox('Enable File/Folder Protection')
    expect(protection.disabled).toBe(true)
    const noteId = protection.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(noteId)?.textContent).toBe('Not available yet')
    expect(getCheckbox('Disable Access to Registry Editor').disabled).toBe(false)
    expect(getDriveCheckbox('Hide Drives (*)', 'A').disabled).toBe(false)
  })

  it('sends only the items the administrator changed, for every listed PC', async () => {
    const onApplyRestrictions = vi.fn<ApplyRestrictions>(async () => affected(2))
    const { onClose } = renderListDialog(
      [
        makeRestrictedPc(1, { policies: ['run-command'], disabledDrives: ['E'] }),
        makeRestrictedPc(2, { policies: ['control-panel'], disabledDrives: ['E'] }),
      ],
      onApplyRestrictions,
    )

    fireEvent.click(getCheckbox('Disable Access to Registry Editor'))
    fireEvent.click(getCheckbox('Disable Run Command (*)'))
    fireEvent.click(getDriveCheckbox('Hide Drives (*)', 'D'))
    fireEvent.click(getDriveCheckbox('Disable Drives (*)', 'E'))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onApplyRestrictions).toHaveBeenCalledWith([1, 2], {
      policies: { 'registry-editor': true, 'run-command': true },
      hiddenDrives: { D: true },
      disabledDrives: { E: false },
      applyNow: false,
    })
  })

  it('does not send an item changed and changed back', () => {
    const onApplyRestrictions = vi.fn<ApplyRestrictions>(async () => affected(1))
    const { onClose } = renderListDialog([makePc(1)], onApplyRestrictions)

    fireEvent.click(getCheckbox('Disable Command Prompt'))
    fireEvent.click(getCheckbox('Disable Command Prompt'))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(onApplyRestrictions).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sends Apply without restarting computer with the change', async () => {
    const onApplyRestrictions = vi.fn<ApplyRestrictions>(async () => affected(1))
    renderListDialog([makePc(1)], onApplyRestrictions)

    fireEvent.click(getCheckbox('Hide Windows Shutdown Button (*)'))
    fireEvent.click(getCheckbox('Apply without restarting computer'))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() =>
      expect(onApplyRestrictions).toHaveBeenCalledWith([1], {
        policies: { 'windows-shutdown': true },
        hiddenDrives: {},
        disabledDrives: {},
        applyNow: true,
      }),
    )
  })

  it('does not restart File Explorer when only Apply without restarting computer is ticked', () => {
    const onApplyRestrictions = vi.fn<ApplyRestrictions>(async () => affected(1))
    const { onClose } = renderListDialog([makePc(1)], onApplyRestrictions)

    fireEvent.click(getCheckbox('Apply without restarting computer'))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(onApplyRestrictions).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('explains when the changes apply', () => {
    renderListDialog([makePc(1)])
    const helpId = getCheckbox('Apply without restarting computer').getAttribute('aria-describedby') ?? ''
    const help = document.getElementById(helpId)?.textContent ?? ''
    expect(help).toContain('File Explorer restarts on the PCs so they apply in a few seconds')
    expect(help).toContain("Otherwise they apply at the student's next sign-in.")
    expect(help).toContain('Registry Editor and Command Prompt apply right away either way.')
    expect(help).toContain('Disabling a drive only blocks it in File Explorer, not in other programs.')
    expect(help).toContain('Needs client 0.32.0 or newer.')
  })

  it('Select/Deselect All sets every item of the group to one state, mixed ones too', async () => {
    const onApplyRestrictions = vi.fn<ApplyRestrictions>(async () => affected(2))
    renderListDialog([makeRestrictedPc(1, { hiddenDrives: ['C'] }), makeRestrictedPc(2, {})], onApplyRestrictions)
    const hideGroup = within(screen.getByRole('group', { name: 'Hide Drives (*)' }))
    const selectAll = hideGroup.getByRole('checkbox', { name: 'Select/Deselect All' }) as HTMLInputElement
    expect(selectAll.indeterminate).toBe(true)

    fireEvent.click(selectAll)
    expect(getDriveCheckbox('Hide Drives (*)', 'C').checked).toBe(true)
    expect(getDriveCheckbox('Hide Drives (*)', 'Z').checked).toBe(true)
    expect(selectAll.checked).toBe(true)

    fireEvent.click(selectAll)
    expect(getDriveCheckbox('Hide Drives (*)', 'C').checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onApplyRestrictions).toHaveBeenCalledTimes(1))
    expect(onApplyRestrictions.mock.calls[0][1].hiddenDrives).toEqual({ C: false })
  })

  it('Select/Deselect All of the policies covers internet, Fast User Switch and Task Manager but not file/folder protection', () => {
    renderListDialog([makePc(1)])
    const grid = within(screen.getByRole('group', { name: 'Policies' }))
    fireEvent.click(grid.getByRole('checkbox', { name: 'Select/Deselect All' }))
    expect(getCheckbox('Disable Add Printer (*)').checked).toBe(true)
    expect(getCheckbox('Block internet').checked).toBe(true)
    expect(getCheckbox('Disable Fast User Switch').checked).toBe(true)
    expect(getCheckbox('Disable Access to Task Manager').checked).toBe(true)
    expect(getCheckbox('Enable File/Folder Protection').checked).toBe(false)
  })

  it('warns when C is hidden or disabled', () => {
    renderListDialog([makePc(1)])
    const warning = 'Hiding or disabling C blocks Desktop, Documents and Downloads in File Explorer.'
    expect(screen.queryByText(warning)).toBeNull()

    fireEvent.click(getDriveCheckbox('Hide Drives (*)', 'C'))
    expect(screen.getByText(warning)).toBeTruthy()

    fireEvent.click(getDriveCheckbox('Hide Drives (*)', 'C'))
    fireEvent.click(getDriveCheckbox('Disable Drives (*)', 'D'))
    expect(screen.queryByText(warning)).toBeNull()

    fireEvent.click(getDriveCheckbox('Disable Drives (*)', 'C'))
    expect(screen.getByText(warning)).toBeTruthy()
  })

  it('stops the chain at a failed Task Manager change', async () => {
    const onApplyTaskManager = vi.fn(async () => ({ success: false as const, status: 400, error: 'Task Manager failed.' }))
    const onApplyRestrictions = vi.fn<ApplyRestrictions>(async () => affected(1))
    const { onClose } = renderDialog([makePc(1)], undefined, undefined, onApplyTaskManager, onApplyRestrictions)

    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(getCheckbox('Disable Access to Control Panel (*)'))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(screen.getByText('Task Manager failed.')).toBeTruthy())
    expect(onApplyRestrictions).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('applies the policies last, after Task Manager succeeds', async () => {
    const calls: string[] = []
    const onApplyTaskManager = vi.fn(async () => {
      calls.push('task-manager')
      return affected(1)
    })
    const onApplyRestrictions = vi.fn<ApplyRestrictions>(async () => {
      calls.push('restrictions')
      return affected(1)
    })
    const { onClose } = renderDialog([makePc(1)], undefined, undefined, onApplyTaskManager, onApplyRestrictions)

    fireEvent.click(getTaskManagerCheckbox())
    fireEvent.click(getCheckbox('Disable Access to Control Panel (*)'))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(calls).toEqual(['task-manager', 'restrictions'])
  })

  it('keeps the dialog open with the error when the change fails', async () => {
    const onApplyRestrictions = vi.fn<ApplyRestrictions>(async () => ({
      success: false as const,
      status: 400,
      error: 'Could not save.',
    }))
    const { onClose } = renderListDialog([makePc(1)], onApplyRestrictions)

    fireEvent.click(getCheckbox('Disable Remove Printer (*)'))
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(screen.getByText('Could not save.')).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
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
