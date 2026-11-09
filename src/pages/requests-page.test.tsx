// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
