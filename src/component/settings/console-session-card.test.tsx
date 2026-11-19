// @vitest-environment jsdom
import { FormProvider } from 'react-hook-form'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestProviders } from '../../test/test-providers'
import { ConsoleSessionCard } from './console-session-card'
import { useSettingsEditor } from './use-settings-editor'

const SAVED_SETTINGS = {
  defaultApproval: { mode: 'time-limit', minutes: 60 },
  notice: { isEnabled: true, text: 'Monitored.' },
  idleTimeoutMinutes: 45,
  defaultViewMode: 'anonymous',
  powerCountdownSeconds: 30,
  lockMessage: 'Locked by the administrator.',
}
const SETTINGS_PATH = '/api/settings'
const STAY_SIGNED_IN_LABEL = 'Stay signed in until I sign out'
const MINUTES_LABEL = 'Sign out after inactivity (minutes)'
const RANGE_MESSAGE = 'Enter a whole number from 5 to 480.'

// Serves the saved settings and echoes back what the admin saves.
function stubSettingsApi(idleTimeoutMinutes: number) {
  const fetchMock = vi.fn((url: string, init: RequestInit) =>
    Promise.resolve(
      url === SETTINGS_PATH && init.method === 'PUT'
        ? Response.json(JSON.parse(String(init.body)))
        : Response.json({ ...SAVED_SETTINGS, idleTimeoutMinutes }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// The same form and save path as the Settings page, reduced to the console session card.
function SettingsHarness() {
  const { form, saveSettingsForm } = useSettingsEditor()
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(saveSettingsForm)} noValidate>
        <ConsoleSessionCard />
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

// The saved view mode is anonymous, so a ticked Anonymous radio means the settings loaded.
async function waitForLoad() {
  await waitFor(() =>
    expect((screen.getByLabelText('Anonymous') as HTMLInputElement).checked).toBe(true),
  )
}

function staySignedInCheckbox() {
  return screen.getByLabelText(STAY_SIGNED_IN_LABEL) as HTMLInputElement
}

function putCalls(fetchMock: ReturnType<typeof stubSettingsApi>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')
}

async function savedIdleTimeout(fetchMock: ReturnType<typeof stubSettingsApi>) {
  await waitFor(() => expect(putCalls(fetchMock)).toHaveLength(1))
  const [, init] = putCalls(fetchMock)[0]
  return JSON.parse(String(init?.body)).idleTimeoutMinutes
}

describe('ConsoleSessionCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ticks stay signed in and hides the minutes when the timeout is 0', async () => {
    stubSettingsApi(0)
    renderCard()
    await waitForLoad()

    expect(staySignedInCheckbox().checked).toBe(true)
    expect(screen.queryByLabelText(MINUTES_LABEL)).toBeNull()
    expect(
      screen.getByText(
        "You'll stay signed in on this computer, even after closing the browser, until you sign out.",
      ),
    ).not.toBeNull()
    expect(screen.getByText('Applies from your next sign-in.')).not.toBeNull()
  })

  it('leaves stay signed in off and shows 45 when the timeout is 45', async () => {
    stubSettingsApi(45)
    renderCard()

    expect(await screen.findByDisplayValue('45')).toBe(screen.getByLabelText(MINUTES_LABEL))
    expect(staySignedInCheckbox().checked).toBe(false)
  })

  it('sends 0 when stay signed in is turned on', async () => {
    const fetchMock = stubSettingsApi(45)
    renderCard()
    await screen.findByDisplayValue('45')

    fireEvent.click(staySignedInCheckbox())
    expect(screen.queryByLabelText(MINUTES_LABEL)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await savedIdleTimeout(fetchMock)).toBe(0)
  })

  it('shows 30 minutes when stay signed in is turned off', async () => {
    stubSettingsApi(0)
    renderCard()
    await waitForLoad()

    fireEvent.click(staySignedInCheckbox())

    expect((screen.getByLabelText(MINUTES_LABEL) as HTMLInputElement).value).toBe('30')
  })

  it.each([5, 480])('sends %d minutes when stay signed in is off', async (minutes) => {
    const fetchMock = stubSettingsApi(45)
    renderCard()

    fireEvent.change(await screen.findByDisplayValue('45'), { target: { value: String(minutes) } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await savedIdleTimeout(fetchMock)).toBe(minutes)
  })

  it.each(['4', '481', ''])('shows the range message for %j and does not save', async (text) => {
    const fetchMock = stubSettingsApi(45)
    renderCard()

    fireEvent.change(await screen.findByDisplayValue('45'), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect((await screen.findByText(RANGE_MESSAGE)).id).toBe('settings-idle-timeout-message')
    expect(screen.getByLabelText(MINUTES_LABEL).getAttribute('aria-invalid')).toBe('true')
    expect(putCalls(fetchMock)).toHaveLength(0)
  })
})
