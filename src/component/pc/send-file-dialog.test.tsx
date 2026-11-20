// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../lib/api'
import { sendFileToPcs, uploadSharedFile } from '../../lib/shared-files-api'
import { makeTransfer } from '../../test/file-transfer-fixtures'
import { TestProviders } from '../../test/test-providers'
import type { RegisteredPc, SharedFile } from '../../types'
import { SendFileDialog } from './send-file-dialog'

vi.mock('../../lib/shared-files-api', () => ({
  uploadSharedFile: vi.fn(),
  sendFileToPcs: vi.fn(),
  getFileTransfers: vi.fn(() => Promise.resolve({ success: true, data: [] })),
  decideFileTransfers: vi.fn(),
}))

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const STORED: SharedFile = { id: 4, name: 'notes.pdf', sizeBytes: 5, sha256: 'a'.repeat(64) }
const notes = new File(['hello'], 'notes.pdf')

function makePc(id: number): RegisteredPc {
  return { id, name: `PC-${id}`, status: 'locked', lastSeen: 'Now' }
}

function renderDialog(targetPcs: RegisteredPc[] = [makePc(1), makePc(2)], skippedOfflineCount = 0) {
  const onClose = vi.fn()
  render(
    <TestProviders>
      <SendFileDialog
        targetPcs={targetPcs}
        skippedOfflineCount={skippedOfflineCount}
        onClose={onClose}
      />
    </TestProviders>,
  )
  return { onClose }
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } })
}

function getSendButton() {
  return screen.getByRole('button', { name: /^Send to|Sending/ }) as HTMLButtonElement
}

describe('SendFileDialog', () => {
  beforeEach(() => {
    vi.mocked(uploadSharedFile).mockReset()
    vi.mocked(sendFileToPcs).mockReset()
    vi.mocked(uploadSharedFile).mockResolvedValue({ success: true, data: STORED })
    vi.mocked(sendFileToPcs).mockResolvedValue({
      success: true,
      data: [makeTransfer(1), makeTransfer(2)],
    })
  })

  it('names the PCs and starts with Desktop and the default subfolder', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Send file to 2 PCs' })).toBeTruthy()
    expect(screen.getByText('PC-1, PC-2')).toBeTruthy()
    expect((screen.getByLabelText('Folder') as HTMLSelectElement).value).toBe('desktop')
    expect((screen.getByLabelText('Subfolder') as HTMLInputElement).value).toBe('Lykantra Share')
    expect(screen.getByText('Desktop\\Lykantra Share')).toBeTruthy()
  })

  it('previews the full path as the choices change', () => {
    renderDialog()
    chooseFile(notes)
    fireEvent.change(screen.getByLabelText('Folder'), { target: { value: 'documents' } })
    fireEvent.change(screen.getByLabelText('Subfolder'), { target: { value: 'Class/3B' } })

    expect(screen.getByText('Documents\\Class\\3B\\notes.pdf')).toBeTruthy()
    expect(screen.getByTitle('notes.pdf').textContent).toBe('notes.pdf · 1 KB')
  })

  it('asks for a file next to the picker when none is chosen', async () => {
    renderDialog()
    fireEvent.click(getSendButton())

    const input = await screen.findByLabelText('File')
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
    expect(screen.getByText('Choose a file.').id).toBe(input.getAttribute('aria-describedby'))
    expect(uploadSharedFile).not.toHaveBeenCalled()
  })

  it('shows a subfolder error next to the field and does not upload', async () => {
    renderDialog()
    chooseFile(notes)
    fireEvent.change(screen.getByLabelText('Subfolder'), { target: { value: 'C:\\Windows' } })
    fireEvent.click(getSendButton())

    expect(
      await screen.findByText('Enter a folder inside the chosen folder, not a full path.'),
    ).toBeTruthy()
    expect(uploadSharedFile).not.toHaveBeenCalled()
  })

  it('uploads the file, sends it to every PC and then shows their status', async () => {
    renderDialog()
    chooseFile(notes)
    fireEvent.change(screen.getByLabelText('Subfolder'), { target: { value: 'a/b' } })
    fireEvent.click(getSendButton())

    expect(await screen.findByRole('heading', { name: 'Sending file to 2 PCs' })).toBeTruthy()
    expect(vi.mocked(uploadSharedFile).mock.calls[0][0]).toBe(notes)
    expect(sendFileToPcs).toHaveBeenCalledWith({
      ids: [1, 2],
      sharedFileId: 4,
      folder: 'desktop',
      subfolder: 'a\\b',
    })
    expect(screen.getByRole('status').textContent).toBe('Saved on 0 of 2 PCs.')
    expect(screen.getAllByText('Waiting for PC')).toHaveLength(2)
    expect(screen.queryByText(/went offline/)).toBeNull()
  })

  it('says which PCs the server skipped because they went offline', async () => {
    vi.mocked(sendFileToPcs).mockResolvedValue({ success: true, data: [makeTransfer(1)] })
    renderDialog()
    chooseFile(notes)
    fireEvent.click(getSendButton())

    expect(await screen.findByRole('heading', { name: 'Sending file to 1 PC' })).toBeTruthy()
    expect(screen.getByText('1 PC went offline and was skipped.')).toBeTruthy()
  })

  it('shows the server message when none of the PCs is online any more', async () => {
    vi.mocked(sendFileToPcs).mockResolvedValue({
      success: false,
      status: 400,
      error: 'None of these PCs are online.',
    })
    renderDialog()
    chooseFile(notes)
    fireEvent.click(getSendButton())

    expect((await screen.findByRole('alert')).textContent).toContain('None of these PCs are online.')
  })

  it('shows the upload progress and disables Send while uploading', async () => {
    let finish: (result: ApiResult<SharedFile>) => void = () => {}
    vi.mocked(uploadSharedFile).mockImplementation(
      (_file, options) =>
        new Promise((resolve) => {
          options?.onProgress?.(42)
          finish = resolve
        }),
    )
    renderDialog()
    chooseFile(notes)
    fireEvent.click(getSendButton())

    const progress = await screen.findByRole('progressbar', { name: 'Upload progress' })
    expect(progress.getAttribute('aria-valuenow')).toBe('42')
    expect(screen.getByText('Uploading… 42%')).toBeTruthy()
    expect(getSendButton().disabled).toBe(true)
    await act(async () => {
      finish({ success: true, data: STORED })
    })
  })

  it('cancels the upload and goes back to the form without an error', async () => {
    vi.mocked(uploadSharedFile).mockImplementation(
      (_file, options) =>
        new Promise((resolve) => {
          options?.signal?.addEventListener('abort', () =>
            resolve({ success: false, status: 0, error: 'Upload cancelled.' }),
          )
        }),
    )
    renderDialog()
    chooseFile(notes)
    fireEvent.click(getSendButton())

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel upload' }))

    await waitFor(() => expect(getSendButton().disabled).toBe(false))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(sendFileToPcs).not.toHaveBeenCalled()
  })

  it('says how many offline PCs were skipped', () => {
    renderDialog([makePc(1)], 2)
    expect(
      screen.getByText('2 offline PCs are skipped. Only online PCs can be sent a file.'),
    ).toBeTruthy()
  })

  it('says nothing about offline PCs when none were skipped', () => {
    renderDialog()
    expect(screen.queryByText(/offline/)).toBeNull()
  })

  it('refuses a file name Windows cannot save under the picker, before uploading', async () => {
    renderDialog()
    chooseFile(new File(['x'], 'CON .txt'))
    fireEvent.click(getSendButton())

    const message = await screen.findByText('Choose a file with a valid Windows file name.')
    expect(message.id).toBe(screen.getByLabelText('File').getAttribute('aria-describedby'))
    expect(uploadSharedFile).not.toHaveBeenCalled()
  })

  it('shows a file name the server refused next to the picker', async () => {
    vi.mocked(uploadSharedFile).mockResolvedValue({
      success: false,
      status: 400,
      error: 'Choose a file with a valid Windows file name.',
    })
    renderDialog()
    chooseFile(notes)
    fireEvent.click(getSendButton())

    expect(await screen.findByText('Choose a file with a valid Windows file name.')).toBeTruthy()
    expect(screen.getByLabelText('File').getAttribute('aria-invalid')).toBe('true')
  })

  it('shows a server error such as low disk space in a banner and keeps the choices', async () => {
    const message = 'The server does not have enough free disk space for this file.'
    vi.mocked(uploadSharedFile).mockResolvedValue({ success: false, status: 507, error: message })
    renderDialog()
    chooseFile(notes)
    fireEvent.click(getSendButton())

    expect((await screen.findByRole('alert')).textContent).toContain(message)
    expect((screen.getByLabelText('Subfolder') as HTMLInputElement).value).toBe('Lykantra Share')
    expect(getSendButton().disabled).toBe(false)
  })

  it('shows a failed send in a banner', async () => {
    vi.mocked(sendFileToPcs).mockResolvedValue({ success: false, status: 400, error: 'Unknown PC.' })
    renderDialog()
    chooseFile(notes)
    fireEvent.click(getSendButton())

    expect((await screen.findByRole('alert')).textContent).toContain('Unknown PC.')
  })

  it('refuses more than 200 PCs', () => {
    renderDialog(Array.from({ length: 201 }, (_, index) => makePc(index + 1)))
    expect(screen.getByRole('alert').textContent).toBe('Choose 200 PCs or fewer.')
    expect(getSendButton().disabled).toBe(true)
  })

  it('closes when Cancel is pressed', () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
