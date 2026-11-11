// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Notify } from '../component/ui/notification-context'
import { TestProviders } from '../test/test-providers'
import { DashboardPage } from './dashboard-page'

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const SAVED_LOCK_MESSAGE = 'Locked for class.'
// The first render of the whole Dashboard can take several seconds when the suite runs in parallel.
const DASHBOARD_TEST_TIMEOUT_MS = 15_000
const SETTINGS_BODY = {
  defaultApproval: { mode: 'time-limit', minutes: 60 },
  notice: { isEnabled: false, text: '' },
  idleTimeoutMinutes: 30,
  defaultViewMode: 'notified',
  powerCountdownSeconds: 30,
  lockMessage: SAVED_LOCK_MESSAGE,
}

function serverPc(id: number) {
  return {
    id,
    name: `PC-0${id}`,
    isOnline: true,
    isLocked: false,
    ipAddress: `192.168.1.${10 + id}`,
    registeredAt: '2026-11-01T08:00:00.000Z',
    lastSeenAt: '2026-11-10T10:00:00.000Z',
    // A signed-in student makes the PC in use, so the card offers Lock rather than Unlock.
    session: {
      username: `student${id}`,
      startedAt: '2026-11-10T09:00:00.000Z',
      time: { mode: 'open-time' },
      secondsRemaining: null,
    },
    shutdownState: null,
    isServerPc: false,
    internetBlocked: false,
    internetBlockApplied: null,
    clientVersion: null,
    clientUpdate: null,
  }
}

// Routes are keyed by "METHOD path". Anything unrouted fails the test visibly.
function stubApi(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    const respond = routes[key]
    const response = respond
      ? respond()
      : Response.json({ error: `Unexpected request: ${key}` }, { status: 500 })
    return Promise.resolve(response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function commandCalls(fetchMock: ReturnType<typeof stubApi>, path: string) {
  return fetchMock.mock.calls.filter(([input, init]) => init?.method === 'POST' && String(input) === path)
}

function renderDashboard(notify?: Notify) {
  render(
    <TestProviders initialPath="/" notify={notify}>
      <DashboardPage />
    </TestProviders>,
  )
}

function standardRoutes() {
  return {
    'GET /api/pcs': () => Response.json([serverPc(1), serverPc(2)]),
    'GET /api/settings': () => Response.json(SETTINGS_BODY),
  }
}

describe('DashboardPage lock message', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('locks one PC with the typed message after asking in the lock dialog', async () => {
    const fetchMock = stubApi({
      ...standardRoutes(),
      'POST /api/pcs/1/lock': () => new Response(null, { status: 204 }),
    })
    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Lock PC-01' }))
    const dialog = screen.getByRole('heading', { name: 'Lock 1 PC?' }).closest('dialog')
    if (!dialog) throw new Error('The lock dialog is not open')
    const field = within(dialog).getByLabelText('Message on the PC (optional)')
    await waitFor(() => expect(field.getAttribute('placeholder')).toBe(SAVED_LOCK_MESSAGE))
    fireEvent.change(field, { target: { value: 'Back at 10:00.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lock' }))

    await waitFor(() => expect(commandCalls(fetchMock, '/api/pcs/1/lock')).toHaveLength(1))
    expect(commandCalls(fetchMock, '/api/pcs/1/lock')[0][1]?.body).toBe(
      '{"message":"Back at 10:00."}',
    )
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('sends a null message when the single-PC dialog is left empty', async () => {
    const fetchMock = stubApi({
      ...standardRoutes(),
      'POST /api/pcs/2/lock': () => new Response(null, { status: 204 }),
    })
    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Lock PC-02' }))
    const dialog = screen.getByRole('heading', { name: 'Lock 1 PC?' }).closest('dialog')
    if (!dialog) throw new Error('The lock dialog is not open')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lock' }))

    await waitFor(() => expect(commandCalls(fetchMock, '/api/pcs/2/lock')).toHaveLength(1))
    expect(commandCalls(fetchMock, '/api/pcs/2/lock')[0][1]?.body).toBe('{"message":null}')
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('locks the selected PCs with the typed message in one bulk command', async () => {
    const fetchMock = stubApi({
      ...standardRoutes(),
      'POST /api/pcs/lock': () => Response.json({ affected: 2 }),
    })
    renderDashboard()

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select PC-01' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select PC-02' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lock (2)' }))
    const dialog = screen.getByRole('heading', { name: 'Lock 2 PCs?' }).closest('dialog')
    if (!dialog) throw new Error('The lock dialog is not open')
    fireEvent.change(within(dialog).getByLabelText('Message on the PC (optional)'), {
      target: { value: 'Class is over.' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lock' }))

    await waitFor(() => expect(commandCalls(fetchMock, '/api/pcs/lock')).toHaveLength(1))
    expect(commandCalls(fetchMock, '/api/pcs/lock')[0][1]?.body).toBe(
      '{"ids":[1,2],"message":"Class is over."}',
    )
  }, DASHBOARD_TEST_TIMEOUT_MS)
})

describe('DashboardPage bulk edit time', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds 30 minutes to every selected PC in one command and reports it', async () => {
    const fetchMock = stubApi({
      ...standardRoutes(),
      'POST /api/pcs/time': () => Response.json({ affected: 2 }),
    })
    const notify = vi.fn()
    renderDashboard(notify)

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit time (2)' }))
    const dialog = screen.getByRole('heading', { name: 'Edit time for 2 PCs' }).closest('dialog')
    if (!dialog) throw new Error('The time dialog is not open')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Added 30m to 2 PCs.', 'clock'))
    expect(commandCalls(fetchMock, '/api/pcs/time')).toHaveLength(1)
    expect(commandCalls(fetchMock, '/api/pcs/time')[0][1]?.body).toBe(
      '{"ids":[1,2],"action":"add-time","minutes":30}',
    )
  }, DASHBOARD_TEST_TIMEOUT_MS)
})

describe('DashboardPage client update selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('counts only the online PCs of the selection for an update', async () => {
    const offlinePc = { ...serverPc(2), isOnline: false, session: null }
    stubApi({
      ...standardRoutes(),
      'GET /api/pcs': () => Response.json([serverPc(1), offlinePc]),
    })
    renderDashboard()

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))

    expect(await screen.findByRole('button', { name: 'Update (1)' })).toBeDefined()
  }, DASHBOARD_TEST_TIMEOUT_MS)
})
