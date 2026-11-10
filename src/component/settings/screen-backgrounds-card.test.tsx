// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TestProviders } from '../../test/test-providers'
import { ScreenBackgroundsCard } from './screen-backgrounds-card'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const EMPTY_TEXT = 'No image — PCs show the plain background.'

const LOGIN_INFO = {
  contentType: 'image/png',
  sizeBytes: 1258291,
  sha256: 'a'.repeat(64),
  updatedAtUtc: '2026-11-10T09:30:00.000Z',
}

const NEW_LOGIN_INFO = { ...LOGIN_INFO, sha256: 'b'.repeat(64), sizeBytes: 2048 }

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
      <ScreenBackgroundsCard />
    </TestProviders>,
  )
  return { notify }
}

async function getSlot(title: string) {
  return within(await screen.findByRole('region', { name: title }))
}

function chooseFile(slot: ReturnType<typeof within>, file: File) {
  fireEvent.change(slot.getByLabelText('Choose image'), { target: { files: [file] } })
}

const png = new File(['png'], 'login.png', { type: 'image/png' })
const gif = new File(['gif'], 'anim.gif', { type: 'image/gif' })

describe('ScreenBackgroundsCard', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview-1')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a loading message while the list loads', () => {
    stubFetch(() => new Promise<Response>(() => {}))
    renderCard()
    expect(screen.getByRole('status').textContent).toBe('Loading screen backgrounds...')
  })

  it('shows empty states when no background is set', async () => {
    stubFetch(() => Response.json({ login: null, lock: null }))
    renderCard()

    expect(await (await getSlot('Login screen')).findByText(EMPTY_TEXT)).not.toBeNull()
    expect((await getSlot('Lock screen')).getByText(EMPTY_TEXT)).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  })

  it('shows the current image with its size and update time', async () => {
    stubFetch(() => Response.json({ login: LOGIN_INFO, lock: null }))
    renderCard()

    const image = await (await getSlot('Login screen')).findByAltText('Current login screen image')
    expect(image.getAttribute('src')).toBe('/api/backgrounds/login/image?v=' + 'a'.repeat(64))
    expect((await getSlot('Login screen')).getByText(/Updated .* · 1\.2 MB/)).not.toBeNull()
  })

  it('shows an error with Retry, and loads again when Retry is pressed', async () => {
    const fetchMock = stubFetch(() => Response.json({ error: 'Server is busy.' }, { status: 500 }))
    renderCard()

    expect((await screen.findByRole('alert')).textContent).toContain('Server is busy.')
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ login: null, lock: null })))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await (await getSlot('Login screen')).findByText(EMPTY_TEXT)).not.toBeNull()
  })

  it('rejects a file that is not PNG or JPEG and does not upload it', async () => {
    const fetchMock = stubFetch(() => Response.json({ login: null, lock: null }))
    renderCard()
    const slot = await getSlot('Login screen')
    await slot.findByText(EMPTY_TEXT)

    chooseFile(slot, gif)

    const input = slot.getByLabelText('Choose image')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const message = slot.getByText('Choose a PNG or JPEG image.')
    expect(input.getAttribute('aria-describedby')).toBe(message.id)
    expect(slot.queryByRole('button', { name: 'Upload' })).toBeNull()
    expect(methodCalls(fetchMock, 'PUT')).toHaveLength(0)
  })

  it('previews a valid file, uploads its bytes, and shows the saved image', async () => {
    let current: unknown = { login: null, lock: null }
    const fetchMock = stubFetch((_url, init) => {
      if (init.method === 'PUT') {
        current = { login: NEW_LOGIN_INFO, lock: null }
        return Response.json(NEW_LOGIN_INFO)
      }
      return Response.json(current)
    })
    const { notify } = renderCard()
    const slot = await getSlot('Login screen')
    await slot.findByText(EMPTY_TEXT)

    chooseFile(slot, png)

    const preview = slot.getByRole('img', { name: 'New login screen image, not uploaded yet' })
    expect(preview.getAttribute('src')).toBe('blob:preview-1')
    expect(slot.getByText('New image: login.png · 1 KB')).not.toBeNull()

    fireEvent.click(slot.getByRole('button', { name: 'Upload' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Login screen background saved.'))

    const [putUrl, putInit] = methodCalls(fetchMock, 'PUT')[0]
    expect(putUrl).toBe('/api/backgrounds/login')
    expect(putInit.body).toBe(png)
    expect(putInit.headers).toEqual({ 'Content-Type': 'image/png' })

    const saved = await slot.findByAltText('Current login screen image')
    expect(saved.getAttribute('src')).toBe('/api/backgrounds/login/image?v=' + 'b'.repeat(64))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
  })

  it('disables Upload while the upload is running', async () => {
    let finishUpload: (response: Response) => void = () => {}
    stubFetch((_url, init) => {
      if (init.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          finishUpload = resolve
        })
      }
      return Response.json({ login: null, lock: null })
    })
    renderCard()
    const slot = await getSlot('Login screen')
    await slot.findByText(EMPTY_TEXT)
    chooseFile(slot, png)

    fireEvent.click(slot.getByRole('button', { name: 'Upload' }))

    const uploading = await slot.findByRole('button', { name: 'Uploading...' })
    expect((uploading as HTMLButtonElement).disabled).toBe(true)
    finishUpload(Response.json(NEW_LOGIN_INFO))
    await waitFor(() => expect(slot.queryByRole('button', { name: 'Uploading...' })).toBeNull())
  })

  it('clears the chosen file when Cancel is pressed', async () => {
    const fetchMock = stubFetch(() => Response.json({ login: null, lock: null }))
    renderCard()
    const slot = await getSlot('Login screen')
    await slot.findByText(EMPTY_TEXT)
    chooseFile(slot, png)

    fireEvent.click(slot.getByRole('button', { name: 'Cancel' }))

    expect(slot.queryByRole('button', { name: 'Upload' })).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
    expect(methodCalls(fetchMock, 'PUT')).toHaveLength(0)
  })

  it('shows the server error inline when the upload is rejected', async () => {
    stubFetch((_url, init) => {
      if (init.method === 'PUT') {
        return Response.json({ error: 'The image must be 5 MB or smaller.' }, { status: 413 })
      }
      return Response.json({ login: null, lock: null })
    })
    renderCard()
    const slot = await getSlot('Login screen')
    await slot.findByText(EMPTY_TEXT)
    chooseFile(slot, png)

    fireEvent.click(slot.getByRole('button', { name: 'Upload' }))

    expect((await slot.findByRole('alert')).textContent).toContain(
      'The image must be 5 MB or smaller.',
    )
    expect((slot.getByRole('button', { name: 'Upload' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('asks for confirmation before removing and then deletes the image', async () => {
    let current: unknown = { login: LOGIN_INFO, lock: null }
    const fetchMock = stubFetch((_url, init) => {
      if (init.method === 'DELETE') {
        current = { login: null, lock: null }
        return new Response(null, { status: 204 })
      }
      return Response.json(current)
    })
    const { notify } = renderCard()
    const slot = await getSlot('Login screen')
    await slot.findByAltText('Current login screen image')

    fireEvent.click(slot.getByRole('button', { name: 'Remove' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Remove the login screen image?' }))
    expect(methodCalls(fetchMock, 'DELETE')).toHaveLength(0)

    fireEvent.click(dialog.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Login screen background removed.'))
    expect(methodCalls(fetchMock, 'DELETE')[0][0]).toBe('/api/backgrounds/login')
    expect(await slot.findByText(EMPTY_TEXT)).not.toBeNull()
  })

  it('keeps the image when the removal is cancelled', async () => {
    const fetchMock = stubFetch(() => Response.json({ login: LOGIN_INFO, lock: null }))
    renderCard()
    const slot = await getSlot('Login screen')
    await slot.findByAltText('Current login screen image')

    fireEvent.click(slot.getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    expect(methodCalls(fetchMock, 'DELETE')).toHaveLength(0)
    expect(slot.getByAltText('Current login screen image')).not.toBeNull()
  })

  it('shows the server error inline when the removal fails', async () => {
    stubFetch((_url, init) => {
      if (init.method === 'DELETE') {
        return Response.json({ error: 'Could not remove the image.' }, { status: 500 })
      }
      return Response.json({ login: LOGIN_INFO, lock: null })
    })
    renderCard()
    const slot = await getSlot('Login screen')
    await slot.findByAltText('Current login screen image')

    fireEvent.click(slot.getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))

    expect((await slot.findByRole('alert')).textContent).toContain('Could not remove the image.')
  })
})
