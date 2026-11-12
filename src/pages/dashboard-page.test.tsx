// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('DashboardPage always awake', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends only the online selected PCs and reports the offline ones as skipped', async () => {
    const offlinePc = { ...serverPc(2), isOnline: false, session: null }
    const fetchMock = stubApi({
      ...standardRoutes(),
      'GET /api/pcs': () => Response.json([serverPc(1), offlinePc, serverPc(3)]),
      'POST /api/pcs/keep-awake': () => Response.json({ affected: 2 }),
    })
    const notify = vi.fn()
    renderDashboard(notify)

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    const group = within(screen.getByRole('group', { name: 'Always awake' }))
    fireEvent.click(group.getByRole('button', { name: 'On (2)' }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'Always awake turned on for 2 PCs. 1 offline PC skipped.',
        'eye',
      ),
    )
    expect(commandCalls(fetchMock, '/api/pcs/keep-awake')[0][1]?.body).toBe(
      '{"ids":[1,3],"keepAwake":true}',
    )
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('turns it off on every selected PC, offline ones too, with no skipped count', async () => {
    const awakePc = (id: number) => ({ ...serverPc(id), keepAwake: true })
    const offlinePc = { ...awakePc(2), isOnline: false, session: null }
    const fetchMock = stubApi({
      ...standardRoutes(),
      'GET /api/pcs': () => Response.json([awakePc(1), offlinePc, awakePc(3)]),
      'POST /api/pcs/keep-awake': () => Response.json({ affected: 3 }),
    })
    const notify = vi.fn()
    renderDashboard(notify)

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    const group = within(screen.getByRole('group', { name: 'Always awake' }))
    fireEvent.click(group.getByRole('button', { name: 'Off (3)' }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Always awake turned off for 3 PCs.', 'eye'),
    )
    expect(commandCalls(fetchMock, '/api/pcs/keep-awake')[0][1]?.body).toBe(
      '{"ids":[1,2,3],"keepAwake":false}',
    )
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('lets only Off be clicked when every selected PC is already always awake', async () => {
    const awakePc = (id: number) => ({ ...serverPc(id), keepAwake: true })
    stubApi({
      ...standardRoutes(),
      'GET /api/pcs': () => Response.json([awakePc(1), awakePc(2)]),
    })
    renderDashboard(vi.fn())

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    const group = within(screen.getByRole('group', { name: 'Always awake' }))
    expect(group.getByRole('button', { name: 'On' })).toHaveProperty('disabled', true)
    expect(group.getByRole('button', { name: 'Off (2)' })).toHaveProperty('disabled', false)
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('lets only On be clicked when no selected PC is always awake', async () => {
    stubApi(standardRoutes())
    renderDashboard(vi.fn())

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    const group = within(screen.getByRole('group', { name: 'Always awake' }))
    expect(group.getByRole('button', { name: 'On (2)' })).toHaveProperty('disabled', false)
    expect(group.getByRole('button', { name: 'Off' })).toHaveProperty('disabled', true)
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('shows the server error when the change fails', async () => {
    const awakePc = (id: number) => ({ ...serverPc(id), keepAwake: true })
    stubApi({
      ...standardRoutes(),
      'GET /api/pcs': () => Response.json([awakePc(1), awakePc(2)]),
      'POST /api/pcs/keep-awake': () => Response.json({ error: 'Server busy.' }, { status: 503 }),
    })
    const notify = vi.fn()
    renderDashboard(notify)

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    const group = within(screen.getByRole('group', { name: 'Always awake' }))
    fireEvent.click(group.getByRole('button', { name: 'Off (2)' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Server busy.', 'alert'))
  }, DASHBOARD_TEST_TIMEOUT_MS)
})

describe('DashboardPage wallpaper', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:wallpaper-preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uploads the chosen image, then sets it on every selected PC', async () => {
    const fetchMock = stubApi({
      ...standardRoutes(),
      'POST /api/wallpapers': () =>
        Response.json({ id: 7, sha256: 'e'.repeat(64), contentType: 'image/png', sizeBytes: 2048 }),
      'POST /api/pcs/wallpaper': () => Response.json({ affected: 2 }),
    })
    const notify = vi.fn()
    renderDashboard(notify)

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wallpaper (2)' }))
    const dialog = screen.getByRole('heading', { name: 'Wallpaper for 2 PCs' }).closest('dialog')
    if (!dialog) throw new Error('The wallpaper dialog is not open')
    const image = new File([new Uint8Array(2048)], 'wall.png', { type: 'image/png' })
    fireEvent.change(within(dialog).getByLabelText('Choose image'), { target: { files: [image] } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply to 2 PCs' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Wallpaper set on 2 PCs.', 'image'))
    const postCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(postCalls.map(([input]) => String(input))).toEqual(['/api/wallpapers', '/api/pcs/wallpaper'])
    expect(postCalls[0][1]?.body).toBe(image)
    expect(postCalls[0][1]?.headers).toEqual({ 'Content-Type': 'image/png' })
    expect(postCalls[1][1]?.body).toBe('{"ids":[1,2],"wallpaperId":7}')
    expect(screen.queryByRole('heading', { name: 'Wallpaper for 2 PCs' })).toBeNull()
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('removes the wallpaper from the selected PCs when a selected PC has one', async () => {
    const fetchMock = stubApi({
      ...standardRoutes(),
      'GET /api/pcs': () =>
        Response.json([
          serverPc(1),
          { ...serverPc(2), wallpaper: { id: 5, sha256: 'f'.repeat(64) } },
        ]),
      'POST /api/pcs/wallpaper': () => Response.json({ affected: 2 }),
    })
    const notify = vi.fn()
    renderDashboard(notify)

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wallpaper (2)' }))
    const dialog = screen.getByRole('heading', { name: 'Wallpaper for 2 PCs' }).closest('dialog')
    if (!dialog) throw new Error('The wallpaper dialog is not open')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove wallpaper' }))

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Wallpaper removed from 2 PCs.', 'image'),
    )
    expect(commandCalls(fetchMock, '/api/pcs/wallpaper')[0][1]?.body).toBe(
      '{"ids":[1,2],"wallpaperId":null}',
    )
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('offers Remove wallpaper only when a selected PC has a wallpaper', async () => {
    stubApi(standardRoutes())
    renderDashboard()

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Wallpaper (2)' }))
    const dialog = screen.getByRole('heading', { name: 'Wallpaper for 2 PCs' }).closest('dialog')
    if (!dialog) throw new Error('The wallpaper dialog is not open')

    expect(within(dialog).queryByRole('button', { name: 'Remove wallpaper' })).toBeNull()
  }, DASHBOARD_TEST_TIMEOUT_MS)
})

describe('DashboardPage rename', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renames a PC from its detail dialog and keeps the dialog on the new name', async () => {
    let listedPcs = [serverPc(1), serverPc(2)]
    const fetchMock = stubApi({
      ...standardRoutes(),
      'GET /api/pcs': () => Response.json(listedPcs),
      'PUT /api/pcs/1/name': () => {
        listedPcs = [serverPc(2), { ...serverPc(1), name: 'PC-9' }]
        return Response.json({ name: 'PC-9' })
      },
    })
    const notify = vi.fn()
    renderDashboard(notify)

    fireEvent.click(await screen.findByRole('button', { name: 'PC-01' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename PC-01' }))
    const dialog = screen.getByRole('heading', { name: 'Rename PC-01' }).closest('dialog')
    if (!dialog) throw new Error('The rename dialog is not open')
    fireEvent.change(within(dialog).getByLabelText('PC number'), { target: { value: '9' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Renamed to PC-9.', 'check'))
    const renameCall = fetchMock.mock.calls.find(([input]) => String(input) === '/api/pcs/1/name')
    expect(renameCall?.[1]?.body).toBe('{"number":9}')
    // The detail dialog stays open under the new name, next to the renamed card.
    expect(await screen.findAllByRole('heading', { name: 'PC-9' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Rename PC-9' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Rename PC-01' })).toBeNull()
  }, DASHBOARD_TEST_TIMEOUT_MS)

  it('keeps the selection on the same PC when another PC takes its old name', async () => {
    let listedPcs = [serverPc(1), serverPc(2)]
    stubApi({
      ...standardRoutes(),
      'GET /api/pcs': () => Response.json(listedPcs),
      // The server also reports PC 1 renamed and a new PC 3 that now has PC 1's old name.
      'PUT /api/pcs/2/name': () => {
        listedPcs = [{ ...serverPc(3), name: 'PC-01' }, { ...serverPc(2), name: 'PC-5' }, { ...serverPc(1), name: 'PC-9' }]
        return Response.json({ name: 'PC-5' })
      },
    })
    renderDashboard()

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select PC-01' }))
    fireEvent.click(screen.getByRole('button', { name: 'PC-02' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename PC-02' }))
    const dialog = screen.getByRole('heading', { name: 'Rename PC-02' }).closest('dialog')
    if (!dialog) throw new Error('The rename dialog is not open')
    fireEvent.change(within(dialog).getByLabelText('PC number'), { target: { value: '5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename' }))

    const renamedFirst = await screen.findByRole<HTMLInputElement>('checkbox', { name: 'Select PC-9' })
    expect(renamedFirst.checked).toBe(true)
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Select PC-01' }).checked).toBe(false)
  }, DASHBOARD_TEST_TIMEOUT_MS)
})
