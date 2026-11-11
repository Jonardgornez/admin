// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../lib/api'
import type { BulkCommandResult } from '../../lib/pcs-api'
import type { RegisteredPc } from '../../types'
import { WallpaperDialog } from './wallpaper-dialog'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

type CommandResult = ApiResult<BulkCommandResult> | null

const SUCCESS: CommandResult = { success: true, data: { affected: 1 } }

function makePc(id: number, overrides: Partial<RegisteredPc> = {}): RegisteredPc {
  return { id, name: `PC-${id}`, status: 'locked', lastSeen: 'Now', ...overrides }
}

const png = new File(['png'], 'wall.png', { type: 'image/png' })
const gif = new File(['gif'], 'anim.gif', { type: 'image/gif' })

interface RenderOverrides {
  isBusy?: boolean
  onApply?: (file: File) => Promise<CommandResult>
  onRemove?: () => Promise<CommandResult>
}

function renderDialog(targetPcs: RegisteredPc[], overrides: RenderOverrides = {}) {
  const onApply = overrides.onApply ?? vi.fn(async () => SUCCESS)
  const onRemove = overrides.onRemove ?? vi.fn(async () => SUCCESS)
  const onClose = vi.fn()
  render(
    <WallpaperDialog
      targetPcs={targetPcs}
      isBusy={overrides.isBusy ?? false}
      onApply={onApply}
      onRemove={onRemove}
      onClose={onClose}
    />,
  )
  return { onApply, onRemove, onClose }
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('Choose image'), { target: { files: [file] } })
}

function getApplyButton() {
  return screen.getByRole('button', { name: /Apply to|Applying/ }) as HTMLButtonElement
}

describe('WallpaperDialog', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:wallpaper-1')
    URL.revokeObjectURL = vi.fn()
  })

  it('names the PCs and their count in the title', () => {
    renderDialog([makePc(1), makePc(2)])
    expect(screen.getByRole('heading', { name: 'Wallpaper for 2 PCs' })).toBeTruthy()
    expect(screen.getByText('PC-1, PC-2')).toBeTruthy()
  })

  it('explains that students cannot change the wallpaper and that offline PCs get it later', () => {
    renderDialog([makePc(1)])
    expect(screen.getByText("Students can't change the wallpaper while it is set.")).toBeTruthy()
    expect(
      screen.getByText('Offline PCs get the wallpaper when they come back online.'),
    ).toBeTruthy()
  })

  it('keeps Apply disabled until a file is chosen', () => {
    renderDialog([makePc(1), makePc(2)])
    expect(getApplyButton().textContent).toBe('Apply to 2 PCs')
    expect(getApplyButton().disabled).toBe(true)
  })

  it('rejects a file that is not PNG or JPEG next to the input, and keeps Apply disabled', () => {
    renderDialog([makePc(1)])
    chooseFile(gif)
    const input = screen.getByLabelText('Choose image')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Choose a PNG or JPEG image.').id).toBe(
      input.getAttribute('aria-describedby'),
    )
    expect(getApplyButton().disabled).toBe(true)
  })

  it('previews a valid file and enables Apply', () => {
    renderDialog([makePc(1)])
    chooseFile(png)
    expect(
      screen.getByRole('img', { name: 'New wallpaper, not applied yet' }).getAttribute('src'),
    ).toBe('blob:wallpaper-1')
    expect(screen.getByText('New image: wall.png · 1 KB')).toBeTruthy()
    expect(getApplyButton().disabled).toBe(false)
  })

  it('applies the chosen file to the PCs', async () => {
    const { onApply } = renderDialog([makePc(1)])
    chooseFile(png)
    fireEvent.click(getApplyButton())
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(png))
  })

  it('does not offer Remove wallpaper when no target PC has one', () => {
    renderDialog([makePc(1), makePc(2)])
    expect(screen.queryByRole('button', { name: 'Remove wallpaper' })).toBeNull()
  })

  it('offers Remove wallpaper and calls it when a target PC has one', async () => {
    const { onRemove } = renderDialog([makePc(1), makePc(2, { wallpaperId: 5 })])
    fireEvent.click(screen.getByRole('button', { name: 'Remove wallpaper' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1))
  })

  it('shows the server error and keeps the dialog open when the command fails', async () => {
    renderDialog([makePc(1)], {
      onApply: async () => ({ success: false, status: 404, error: 'Unknown wallpaper.' }),
    })
    chooseFile(png)
    fireEvent.click(getApplyButton())
    expect((await screen.findByRole('alert')).textContent).toContain('Unknown wallpaper.')
    expect(getApplyButton().disabled).toBe(false)
  })

  it('shows no error when the command did not run because another is in flight', async () => {
    renderDialog([makePc(1)], { onApply: async () => null })
    chooseFile(png)
    fireEvent.click(getApplyButton())
    await waitFor(() => expect(getApplyButton().textContent).toBe('Apply to 1 PC'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows Applying... and disables Apply while the command runs', async () => {
    let finish: (result: CommandResult) => void = () => {}
    renderDialog([makePc(1)], {
      onApply: () =>
        new Promise<CommandResult>((resolve) => {
          finish = resolve
        }),
    })
    chooseFile(png)
    fireEvent.click(getApplyButton())
    const applying = await screen.findByRole('button', { name: 'Applying...' })
    expect((applying as HTMLButtonElement).disabled).toBe(true)
    finish(SUCCESS)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Applying...' })).toBeNull())
  })

  it('disables the file input and the remove action while another bulk command is busy', () => {
    renderDialog([makePc(1, { wallpaperId: 5 })], { isBusy: true })
    expect((screen.getByLabelText('Choose image') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Remove wallpaper' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('closes when Cancel is pressed', () => {
    const { onClose } = renderDialog([makePc(1)])
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
