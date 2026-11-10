// @vitest-environment jsdom
import { FormProvider } from 'react-hook-form'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestProviders } from '../../test/test-providers'
import { LockScreenCard } from './lock-screen-card'
import { useSettingsEditor } from './use-settings-editor'

const SAVED_LOCK_MESSAGE = 'Locked for class.'
const SAVED_SETTINGS = {
  defaultApproval: { mode: 'time-limit', minutes: 60 },
  notice: { isEnabled: true, text: 'Monitored.' },
  idleTimeoutMinutes: 30,
  defaultViewMode: 'notified',
  powerCountdownSeconds: 30,
  lockMessage: SAVED_LOCK_MESSAGE,
}
const SETTINGS_PATH = '/api/settings'

type Handler = (url: string, init: RequestInit) => Response

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((url: string, init: RequestInit) => Promise.resolve(handler(url, init)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Serves the saved settings and echoes back what the admin saves.
function stubSettingsApi() {
  return stubFetch((url, init) => {
    if (url === SETTINGS_PATH && init.method === 'PUT') return Response.json(JSON.parse(String(init.body)))
    return Response.json(SAVED_SETTINGS)
  })
}

// The same form and save path as the Settings page, reduced to the lock screen card.
function SettingsHarness() {
  const { form, saveSettingsForm } = useSettingsEditor()
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(saveSettingsForm)} noValidate>
        <LockScreenCard />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  )
}

function renderCard() {
  const notify = vi.fn()
  render(
    <TestProviders notify={notify}>
      <SettingsHarness />
    </TestProviders>,
  )
  return { notify }
}

async function loadCard() {
  await screen.findByDisplayValue(SAVED_LOCK_MESSAGE)
  return screen.getByLabelText('Lock screen message')
}

function putCalls(fetchMock: ReturnType<typeof stubSettingsApi>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')
}

describe('LockScreenCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the saved lock screen message with its counter', async () => {
    stubSettingsApi()
    renderCard()

    await loadCard()
    expect(screen.getByText('17/200')).not.toBeNull()
  })

  it('updates the counter as the admin types', async () => {
    stubSettingsApi()
    renderCard()

    fireEvent.change(await loadCard(), { target: { value: 'Gone to lunch' } })

    expect(screen.getByText('13/200')).not.toBeNull()
  })

  it('shows the required message and does not save when the text is blank', async () => {
    const fetchMock = stubSettingsApi()
    renderCard()

    fireEvent.change(await loadCard(), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect((await screen.findByText('Enter the lock screen message.')).id).toBe(
      'settings-lock-message-message',
    )
    expect(screen.getByLabelText('Lock screen message').getAttribute('aria-invalid')).toBe('true')
    expect(putCalls(fetchMock)).toHaveLength(0)
  })

  it('shows the length message for 201 characters and does not save', async () => {
    const fetchMock = stubSettingsApi()
    renderCard()

    fireEvent.change(await loadCard(), { target: { value: 'a'.repeat(201) } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('The lock screen message must be 200 characters or fewer.'),
    ).not.toBeNull()
    expect(putCalls(fetchMock)).toHaveLength(0)
  })

  it('shows the character message for a line break and does not save', async () => {
    const fetchMock = stubSettingsApi()
    renderCard()

    fireEvent.change(await loadCard(), { target: { value: 'Line one\nLine two' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText("The lock screen message can't contain a character that can't be shown."),
    ).not.toBeNull()
    expect(putCalls(fetchMock)).toHaveLength(0)
  })

  it('saves the edited message as lockMessage in the settings payload', async () => {
    const fetchMock = stubSettingsApi()
    const { notify } = renderCard()

    fireEvent.change(await loadCard(), { target: { value: '  Back at 10:00.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Settings saved.'))
    const [url, init] = putCalls(fetchMock)[0]
    expect(url).toBe(SETTINGS_PATH)
    expect(JSON.parse(String(init?.body))).toMatchObject({ lockMessage: 'Back at 10:00.' })
  })
})
