// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { TestProviders } from '../../test/test-providers'
import { UninstallPasswordCard } from './uninstall-password-card'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const PATH = '/api/settings/uninstall-password'
const NEW_PASSWORD_LABEL = 'New password'
const CONFIRM_LABEL = 'Confirm password'

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((url: string, init: RequestInit) =>
    Promise.resolve(handler(url, init)),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function putCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([, init]) => init.method === 'PUT')
}

function renderCard() {
  const notify = vi.fn()
  render(
    <TestProviders notify={notify}>
      <UninstallPasswordCard />
    </TestProviders>,
  )
  return { notify }
}

function inputValue(label: string): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value
}

function fillPasswords(password: string, confirmPassword: string) {
  fireEvent.change(screen.getByLabelText(NEW_PASSWORD_LABEL), { target: { value: password } })
  fireEvent.change(screen.getByLabelText(CONFIRM_LABEL), { target: { value: confirmPassword } })
}

function clickSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }))
}

describe('UninstallPasswordCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the hint and a loading message while the status loads', () => {
    stubFetch(() => new Promise<Response>(() => {}))
    renderCard()
    expect(
      screen.getByText(/only PCs on client 0\.24\.0 or later are protected\. Use a long password/),
    ).not.toBeNull()
    expect(screen.getByText(/each PC keeps a hash of it/)).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Loading uninstall password...')
  })

  it('shows Not set and no Clear button when no password is set', async () => {
    stubFetch(() => Response.json({ isSet: false }))
    renderCard()

    expect(await screen.findByText('Not set')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear password' })).toBeNull()
  })

  it('shows Set and a Clear button when a password is set', async () => {
    stubFetch(() => Response.json({ isSet: true }))
    renderCard()

    expect(await screen.findByText('Set')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Clear password' })).not.toBeNull()
  })

  it('labels both password inputs and hides what is typed', async () => {
    stubFetch(() => Response.json({ isSet: false }))
    renderCard()
    await screen.findByText('Not set')

    expect(screen.getByLabelText(NEW_PASSWORD_LABEL).getAttribute('type')).toBe('password')
    expect(screen.getByLabelText(CONFIRM_LABEL).getAttribute('type')).toBe('password')
  })

  it('shows an error with Retry, and loads again when Retry is pressed', async () => {
    const fetchMock = stubFetch(() => Response.json({ error: 'Server is busy.' }, { status: 500 }))
    renderCard()

    expect((await screen.findByRole('alert')).textContent).toContain('Server is busy.')
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ isSet: false })))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Not set')).not.toBeNull()
  })

  it('shows a message for a password shorter than 8 characters and does not save', async () => {
    const fetchMock = stubFetch(() => Response.json({ isSet: false }))
    renderCard()
    await screen.findByText('Not set')

    fillPasswords('short', 'short')
    clickSave()

    expect(await screen.findByText('Password must be at least 8 characters.')).not.toBeNull()
    expect(screen.getByLabelText(NEW_PASSWORD_LABEL).getAttribute('aria-invalid')).toBe('true')
    expect(putCalls(fetchMock)).toHaveLength(0)
  })

  it('shows a message when the passwords do not match and does not save', async () => {
    const fetchMock = stubFetch(() => Response.json({ isSet: false }))
    renderCard()
    await screen.findByText('Not set')

    fillPasswords('lab-secret-1', 'lab-secret-2')
    clickSave()

    expect(await screen.findByText('Passwords do not match.')).not.toBeNull()
    expect(putCalls(fetchMock)).toHaveLength(0)
  })

  it('saves the password, clears the fields and shows the new status', async () => {
    const fetchMock = stubFetch((_url, init) => Response.json({ isSet: init.method === 'PUT' }))
    const { notify } = renderCard()
    await screen.findByText('Not set')

    fillPasswords('lab-secret-1', 'lab-secret-1')
    clickSave()

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Uninstall password saved.'))
    const [putUrl, putInit] = putCalls(fetchMock)[0]
    expect(putUrl).toBe(PATH)
    expect(JSON.parse(String(putInit.body))).toEqual({ password: 'lab-secret-1' })
    expect(await screen.findByText('Set')).not.toBeNull()
    expect(inputValue(NEW_PASSWORD_LABEL)).toBe('')
    expect(inputValue(CONFIRM_LABEL)).toBe('')
  })

  it('shows Saving and does not send a second save while one is running', async () => {
    let finishSave: (response: Response) => void = () => {}
    const fetchMock = stubFetch((_url, init) => {
      if (init.method === 'PUT') {
        return new Promise<Response>((resolve) => {
          finishSave = resolve
        })
      }
      return Response.json({ isSet: false })
    })
    renderCard()
    await screen.findByText('Not set')
    fillPasswords('lab-secret-1', 'lab-secret-1')

    clickSave()

    const saving = await screen.findByRole('button', { name: 'Saving...' })
    expect((saving as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(saving)
    expect(putCalls(fetchMock)).toHaveLength(1)

    finishSave(Response.json({ isSet: true }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Saving...' })).toBeNull())
  })

  it('shows the server error and keeps what was typed when the save is rejected', async () => {
    const serverMessage = 'Password must be at most 128 characters.'
    stubFetch((_url, init) => {
      if (init.method === 'PUT') return Response.json({ error: serverMessage }, { status: 400 })
      return Response.json({ isSet: false })
    })
    renderCard()
    await screen.findByText('Not set')

    fillPasswords('lab-secret-1', 'lab-secret-1')
    clickSave()

    expect((await screen.findByRole('alert')).textContent).toContain(serverMessage)
    expect(inputValue(NEW_PASSWORD_LABEL)).toBe('lab-secret-1')
    expect(screen.getByText('Not set')).not.toBeNull()
  })

  it('asks for confirmation before clearing and then sends a null password', async () => {
    const fetchMock = stubFetch((_url, init) => Response.json({ isSet: init.method !== 'PUT' }))
    const { notify } = renderCard()
    await screen.findByText('Set')

    fireEvent.click(screen.getByRole('button', { name: 'Clear password' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Clear the uninstall password?' }))
    expect(putCalls(fetchMock)).toHaveLength(0)

    fireEvent.click(dialog.getByRole('button', { name: 'Clear password' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Uninstall password cleared.'))
    const [putUrl, putInit] = putCalls(fetchMock)[0]
    expect(putUrl).toBe(PATH)
    expect(JSON.parse(String(putInit.body))).toEqual({ password: null })
    expect(await screen.findByText('Not set')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear password' })).toBeNull()
  })

  it('keeps the password when clearing is cancelled', async () => {
    const fetchMock = stubFetch(() => Response.json({ isSet: true }))
    renderCard()
    await screen.findByText('Set')

    fireEvent.click(screen.getByRole('button', { name: 'Clear password' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    expect(putCalls(fetchMock)).toHaveLength(0)
    expect(screen.getByText('Set')).not.toBeNull()
  })

  it('shows the server error inline when clearing fails', async () => {
    stubFetch((_url, init) => {
      if (init.method === 'PUT') {
        return Response.json({ error: 'Could not clear the password.' }, { status: 500 })
      }
      return Response.json({ isSet: true })
    })
    renderCard()
    await screen.findByText('Set')

    fireEvent.click(screen.getByRole('button', { name: 'Clear password' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear password' }),
    )

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not clear the password.',
    )
    expect(screen.getByText('Set')).not.toBeNull()
  })
})
