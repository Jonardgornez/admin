// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Notify } from '../component/ui/notification-context'
import {
  LOGIN_REQUEST_LIST_PATH,
  loginRequestListsBody,
  makeLoginRequest,
} from '../test/login-request-fixtures'
import { TestProviders } from '../test/test-providers'
import type { LoginRequest } from '../types'
import { RequestsPage } from './requests-page'

const EXPIRED_MESSAGE = 'This request expired. Ask the student to request again.'
const POLL_INTERVAL_MS = 3000
const APPROVE_PC_01 = '/api/login-requests/1/approve'
const SETTINGS_BODY = {
  defaultApproval: { mode: 'time-limit', minutes: 60 },
  notice: { isEnabled: false, text: '' },
  idleTimeoutMinutes: 15,
  defaultViewMode: 'notified',
  powerCountdownSeconds: 60,
}

type Responder = () => Response

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

// Routes are keyed by "METHOD path". Anything unrouted fails the test visibly.
function stubApi(routes: Record<string, Responder>) {
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

function settingsRoute(): Responder {
  return () => Response.json(SETTINGS_BODY)
}

function listRoute(pending: LoginRequest[], history: LoginRequest[] = []): Responder {
  return () => Response.json(loginRequestListsBody(pending, history))
}

function renderRequestsPage(notify: Notify = vi.fn()) {
  return render(
    <TestProviders initialPath="/requests" notify={notify}>
      <RequestsPage />
    </TestProviders>,
  )
}

function findCardFor(pcName: string): HTMLElement {
  const card = screen.getAllByRole('article').find((article) => within(article).queryByText(pcName))
  if (!card) throw new Error(`No request card for ${pcName}`)
  return card
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('RequestsPage', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('lists the waiting requests, their count, and the history', async () => {
    const approvedNine = makeLoginRequest(9, {
      status: 'approved',
      time: { mode: 'open-time' },
      decidedAt: '2026-11-05T09:00:00.000Z',
    })
    stubApi({
      [`GET ${LOGIN_REQUEST_LIST_PATH}`]: listRoute(
        [makeLoginRequest(1), makeLoginRequest(2)],
        [approvedNine],
      ),
      'GET /api/settings': settingsRoute(),
    })
    renderRequestsPage()

    expect(await screen.findByRole('heading', { name: 'PC-01' })).toBeTruthy()
    expect(screen.getByText('2 waiting')).toBeTruthy()
    expect(screen.getByText('PC-09')).toBeTruthy()
    expect(screen.getByText('Approved')).toBeTruthy()
  })

  it('says so when nothing is waiting', async () => {
    stubApi({
      [`GET ${LOGIN_REQUEST_LIST_PATH}`]: listRoute([]),
      'GET /api/settings': settingsRoute(),
    })
    renderRequestsPage()

    expect(await screen.findByText('No requests waiting.')).toBeTruthy()
  })

  it('offers a retry when the list cannot be loaded', async () => {
    stubApi({
      [`GET ${LOGIN_REQUEST_LIST_PATH}`]: () =>
        Response.json({ error: 'Database is down.' }, { status: 500 }),
      'GET /api/settings': settingsRoute(),
    })
    renderRequestsPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Database is down.')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('shows a refused approval on its card, not as a notification', async () => {
    const notify = vi.fn()
    stubApi({
      [`GET ${LOGIN_REQUEST_LIST_PATH}`]: listRoute([makeLoginRequest(1)]),
      'GET /api/settings': settingsRoute(),
      [`POST ${APPROVE_PC_01}`]: () => Response.json({ error: EXPIRED_MESSAGE }, { status: 409 }),
    })
    renderRequestsPage(notify)

    await screen.findByRole('heading', { name: 'PC-01' })
    const card = findCardFor('PC-01')
    fireEvent.click(within(card).getByRole('button', { name: 'Approve' }))

    const alert = await within(card).findByRole('alert')
    expect(alert.textContent).toBe(EXPIRED_MESSAGE)
    expect(notify).not.toHaveBeenCalled()
  })

  it('notifies and moves the request to history when it is approved', async () => {
    const notify = vi.fn()
    const approvedOne = makeLoginRequest(1, {
      status: 'approved',
      time: { mode: 'time-limit', minutes: 60 },
      decidedAt: '2026-11-05T10:06:00.000Z',
    })
    stubApi({
      [`GET ${LOGIN_REQUEST_LIST_PATH}`]: listRoute([makeLoginRequest(1)]),
      'GET /api/settings': settingsRoute(),
      [`POST ${APPROVE_PC_01}`]: () => Response.json(approvedOne),
    })
    renderRequestsPage(notify)

    await screen.findByRole('heading', { name: 'PC-01' })
    fireEvent.click(within(findCardFor('PC-01')).getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Request from PC-01 approved.'))
    expect(screen.queryByRole('heading', { name: 'PC-01' })).toBeNull()
    expect(screen.getByText('No requests waiting.')).toBeTruthy()
  })

  describe('approve all', () => {
    function approvedRequest(id: number) {
      return makeLoginRequest(id, {
        status: 'approved',
        time: { mode: 'time-limit', minutes: 60 },
        decidedAt: '2026-11-05T10:06:00.000Z',
      })
    }

    it('asks first, then approves every waiting request with the default time', async () => {
      const notify = vi.fn()
      const fetchMock = stubApi({
        [`GET ${LOGIN_REQUEST_LIST_PATH}`]: listRoute([makeLoginRequest(1), makeLoginRequest(2)]),
        'GET /api/settings': settingsRoute(),
        'POST /api/login-requests/1/approve': () => Response.json(approvedRequest(1)),
        'POST /api/login-requests/2/approve': () => Response.json(approvedRequest(2)),
      })
      renderRequestsPage(notify)
      await screen.findByRole('heading', { name: 'PC-01' })

      fireEvent.click(screen.getByRole('button', { name: 'Approve all' }))
      const dialog = screen.getByRole('heading', { name: 'Approve 2 requests?' }).closest('dialog')
      if (!dialog) throw new Error('The approve all dialog is not open')
      expect(dialog.textContent).toContain('Each PC gets 1h, the default in Settings.')
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)

      fireEvent.click(within(dialog).getByRole('button', { name: 'Approve all' }))

      await waitFor(() => expect(notify).toHaveBeenCalledWith('Approved 2 requests.', undefined))
      expect(screen.getByText('No requests waiting.')).toBeTruthy()
      const approveCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/1/approve'))
      expect(approveCall?.[1]?.body).toBe(JSON.stringify({ time: { mode: 'time-limit', minutes: 60 } }))
    })

    it('says how many could not be approved and leaves them waiting', async () => {
      const notify = vi.fn()
      stubApi({
        [`GET ${LOGIN_REQUEST_LIST_PATH}`]: listRoute([makeLoginRequest(1), makeLoginRequest(2)]),
        'GET /api/settings': settingsRoute(),
        'POST /api/login-requests/1/approve': () =>
          Response.json({ error: EXPIRED_MESSAGE }, { status: 409 }),
        'POST /api/login-requests/2/approve': () => Response.json(approvedRequest(2)),
      })
      renderRequestsPage(notify)
      await screen.findByRole('heading', { name: 'PC-01' })

      fireEvent.click(screen.getByRole('button', { name: 'Approve all' }))
      const dialog = screen.getByRole('heading', { name: 'Approve 2 requests?' }).closest('dialog')
      if (!dialog) throw new Error('The approve all dialog is not open')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Approve all' }))

      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith("Approved 1 of 2. 1 request couldn't be approved.", 'alert'),
      )
      expect(screen.getByRole('heading', { name: 'PC-01' })).toBeTruthy()
    })

    it('is disabled when nothing is waiting', async () => {
      stubApi({
        [`GET ${LOGIN_REQUEST_LIST_PATH}`]: listRoute([]),
        'GET /api/settings': settingsRoute(),
      })
      renderRequestsPage()
      await screen.findByText('No requests waiting.')

      expect((screen.getByRole('button', { name: 'Approve all' }) as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('pages through the history', async () => {
    const decided = (id: number) =>
      makeLoginRequest(id, { status: 'denied', decidedAt: '2026-11-05T09:00:00.000Z' })
    stubApi({
      [`GET ${LOGIN_REQUEST_LIST_PATH}`]: () =>
        Response.json(loginRequestListsBody([], [decided(30)], { historyTotal: 15 })),
      'GET /api/login-requests?historyPage=2': () =>
        Response.json(loginRequestListsBody([], [decided(12)], { historyTotal: 15, historyPage: 2 })),
      'GET /api/settings': settingsRoute(),
    })
    renderRequestsPage()

    expect(await screen.findByText('PC-30')).toBeTruthy()
    expect(screen.getByText('Page 1 of 2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('PC-12')).toBeTruthy()
    expect(screen.getByText('Page 2 of 2')).toBeTruthy()
    expect(screen.queryByText('PC-30')).toBeNull()
  })

  it('keeps an edit in progress when a poll brings new data for the same request', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let pending: LoginRequest[] = [makeLoginRequest(1)]
    stubApi({
      [`GET ${LOGIN_REQUEST_LIST_PATH}`]: () => Response.json(loginRequestListsBody(pending)),
      'GET /api/settings': settingsRoute(),
    })
    renderRequestsPage()
    await advance(0)

    fireEvent.change(screen.getByLabelText('Minutes for PC-01'), { target: { value: '45' } })
    // The new list puts PC-02 first, so the card for PC-01 must follow its id, not its position.
    pending = [makeLoginRequest(2), makeLoginRequest(1, { requestedAt: '2026-11-05T10:03:00.000Z' })]
    await advance(POLL_INTERVAL_MS)

    expect(screen.getByRole('heading', { name: 'PC-02' })).toBeTruthy()
    expect((screen.getByLabelText('Minutes for PC-01') as HTMLInputElement).value).toBe('45')
  })
})
