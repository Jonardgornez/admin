// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { TestProviders } from '../../test/test-providers'
import { ClientUpdateCard } from './client-update-card'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const EMPTY_TEXT = 'No update uploaded.'
const CHOOSE_LABEL = 'Choose installer'

const RELEASE = {
  version: '0.20.0',
  sha256: 'a'.repeat(64),
  sizeBytes: 75 * 1024 * 1024,
  uploadedAtUtc: '2026-11-10T09:30:00.000Z',
}

const NEW_RELEASE = { ...RELEASE, version: '0.21.0', sha256: 'b'.repeat(64) }

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((url: string, init: RequestInit) =>
    Promise.resolve(handler(url, init)),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function methodCalls(fetchMock: ReturnType<typeof stubFetch>, method: string) {
  return fetchMock.mock.calls.filter(([, init]) => init.method === method)
}

function renderCard() {
  const notify = vi.fn()
  render(
    <TestProviders notify={notify}>
      <ClientUpdateCard />
    </TestProviders>,
  )
  return { notify }
}

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText(CHOOSE_LABEL), { target: { files: [file] } })
}

function makeInstaller(name = 'LykantraSetup.exe', sizeBytes?: number): File {
  const file = new File(['MZ'], name, { type: 'application/x-msdownload' })
  if (sizeBytes !== undefined) Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

describe('ClientUpdateCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the hint and a loading message while the release loads', () => {
    stubFetch(() => new Promise<Response>(() => {}))
    renderCard()
    expect(
      screen.getByText(/only if it is newer than the version the PC already has/),
    ).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Loading client update...')
  })

  it('shows an empty state when no installer is uploaded', async () => {
    stubFetch(() => Response.json({ release: null }))
    renderCard()

    expect(await screen.findByText(EMPTY_TEXT)).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  })

  it('shows the uploaded version, size and upload date', async () => {
    stubFetch(() => Response.json({ release: RELEASE }))
    renderCard()

    expect(await screen.findByText('v0.20.0')).not.toBeNull()
    expect(screen.getByText(/75\.0 MB · Uploaded /)).not.toBeNull()
  })

  it('shows an error with Retry, and loads again when Retry is pressed', async () => {
    const fetchMock = stubFetch(() => Response.json({ error: 'Server is busy.' }, { status: 500 }))
    renderCard()

    expect((await screen.findByRole('alert')).textContent).toContain('Server is busy.')
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ release: null })))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText(EMPTY_TEXT)).not.toBeNull()
  })

  it('rejects a file that is not an .exe and does not upload it', async () => {
    const fetchMock = stubFetch(() => Response.json({ release: null }))
    renderCard()
    await screen.findByText(EMPTY_TEXT)

    chooseFile(new File(['zip'], 'LykantraSetup.zip', { type: 'application/zip' }))

    const input = screen.getByLabelText(CHOOSE_LABEL)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const message = screen.getByText('Choose LykantraSetup.exe.')
    expect(input.getAttribute('aria-describedby')).toBe(message.id)
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull()
    expect(methodCalls(fetchMock, 'PUT')).toHaveLength(0)
  })

  it('rejects an installer over 150 MB and does not upload it', async () => {
    const fetchMock = stubFetch(() => Response.json({ release: null }))
    renderCard()
    await screen.findByText(EMPTY_TEXT)

    chooseFile(makeInstaller('LykantraSetup.exe', 150 * 1024 * 1024 + 1))

    expect(screen.getByText('The installer must be 150 MB or smaller.')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull()
    expect(methodCalls(fetchMock, 'PUT')).toHaveLength(0)
  })

  it('sends the installer as an octet-stream upload and shows the new release', async () => {
    let current: unknown = { release: null }
    const fetchMock = stubFetch((_url, init) => {
      if (init.method === 'PUT') {
        current = { release: NEW_RELEASE }
        return Response.json(NEW_RELEASE)
      }
      return Response.json(current)
    })
    const { notify } = renderCard()
    await screen.findByText(EMPTY_TEXT)
    const installer = makeInstaller()

    chooseFile(installer)
    expect(screen.getByText(/New installer: LykantraSetup\.exe/)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Client update v0.21.0 uploaded.'),
    )
    const [putUrl, putInit] = methodCalls(fetchMock, 'PUT')[0]
    expect(putUrl).toBe('/api/client-updates')
    expect(putInit.body).toBe(installer)
    expect(putInit.headers).toEqual({ 'Content-Type': 'application/octet-stream' })
    expect(await screen.findByText('v0.21.0')).not.toBeNull()
  })

  it('shows Uploading and does not send a second upload while one is running', async () => {
    let finishUpload: (response: Response) => void = () => {}
    const fetchMock = stubFetch((_url, init) => {
      if (init.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          finishUpload = resolve
        })
      }
      return Response.json({ release: null })
    })
    renderCard()
    await screen.findByText(EMPTY_TEXT)
    chooseFile(makeInstaller())

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    const uploading = await screen.findByRole('button', { name: 'Uploading…' })
    expect((uploading as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(uploading)
    expect(methodCalls(fetchMock, 'PUT')).toHaveLength(1)

    finishUpload(Response.json(NEW_RELEASE))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Uploading…' })).toBeNull())
  })

  it('shows the server error inline when the upload is rejected', async () => {
    const serverMessage = 'This installer is version 0.19.0. Upload a version newer than 0.20.0.'
    stubFetch((_url, init) => {
      if (init.method === 'PUT') {
        return Response.json({ error: serverMessage }, { status: 400 })
      }
      return Response.json({ release: RELEASE })
    })
    renderCard()
    await screen.findByText('v0.20.0')
    chooseFile(makeInstaller())

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    expect((await screen.findByRole('alert')).textContent).toContain(serverMessage)
    expect((screen.getByRole('button', { name: 'Upload' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('asks for confirmation before removing and then deletes the installer', async () => {
    let current: unknown = { release: RELEASE }
    const fetchMock = stubFetch((_url, init) => {
      if (init.method === 'DELETE') {
        current = { release: null }
        return new Response(null, { status: 204 })
      }
      return Response.json(current)
    })
    const { notify } = renderCard()
    await screen.findByText('v0.20.0')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Remove the client update?' }))
    expect(dialog.getByText("PCs that haven't installed it yet won't get it.")).not.toBeNull()
    expect(methodCalls(fetchMock, 'DELETE')).toHaveLength(0)

    fireEvent.click(dialog.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Client update removed.'))
    expect(methodCalls(fetchMock, 'DELETE')[0][0]).toBe('/api/client-updates')
    expect(await screen.findByText(EMPTY_TEXT)).not.toBeNull()
  })

  it('keeps the installer when the removal is cancelled', async () => {
    const fetchMock = stubFetch(() => Response.json({ release: RELEASE }))
    renderCard()
    await screen.findByText('v0.20.0')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    expect(methodCalls(fetchMock, 'DELETE')).toHaveLength(0)
    expect(screen.getByText('v0.20.0')).not.toBeNull()
  })

  it('shows the server error inline when the removal fails', async () => {
    stubFetch((_url, init) => {
      if (init.method === 'DELETE') {
        return Response.json({ error: 'Could not remove the installer.' }, { status: 500 })
      }
      return Response.json({ release: RELEASE })
    })
    renderCard()
    await screen.findByText('v0.20.0')

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not remove the installer.',
    )
  })
})
