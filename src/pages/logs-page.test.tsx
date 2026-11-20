// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notify } from '../component/ui/notification-context'
import { saveBlobAsFile } from '../lib/file-download'
import { TestProviders } from '../test/test-providers'
import type { SessionLog, SessionLogPage } from '../types'
import { LogsPage } from './logs-page'

vi.mock('../lib/file-download', () => ({ saveBlobAsFile: vi.fn() }))

// jsdom does not implement showModal, so the open state is set by hand.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

const LIST_PATH = '/api/session-logs'
const EXPORT_PATH = '/api/session-logs/export'
const PCS_PATH = '/api/pcs'
const PURGE_PREVIEW_PATH = '/api/session-logs/purge-preview'
const PURGE_PATH = '/api/session-logs/purge'

const runningLog: SessionLog = {
  id: 2,
  pcName: 'PC-07',
  userOrSource: 'lab-pc07',
  source: 'account',
  startedAt: '2026-11-09T08:45:00.000Z',
  endedAt: null,
  durationMinutes: 12,
  endReason: null,
}

const endedLog: SessionLog = {
  id: 1,
  pcName: 'PC-06',
  userOrSource: 'Login request',
  source: 'login-request',
  startedAt: '2026-11-08T09:52:00.000Z',
  endedAt: '2026-11-08T10:52:00.000Z',
  durationMinutes: 60,
  endReason: 'time-expired',
}

function serverPc(id: number, name: string) {
  return {
    id,
    name,
    isOnline: true,
    isLocked: false,
    ipAddress: null,
    registeredAt: '2026-11-01T08:00:00.000Z',
    lastSeenAt: '2026-11-10T10:00:00.000Z',
    session: null,
    shutdownState: null,
    isServerPc: false,
  }
}

const PCS = [serverPc(10, 'PC-10'), serverPc(1, 'PC-1'), serverPc(2, 'PC-2')]

// Serves the server's paging contract: 25 sessions in pages of 10, and a page past the end is clamped.
function listPage(url: URL): Response {
  const requestedPage = Number(url.searchParams.get('page') ?? '1')
  const totalItems = 25
  const lastPage = Math.ceil(totalItems / 10)
  const page = Math.min(requestedPage, lastPage)
  const start = (page - 1) * 10
  const count = Math.min(10, totalItems - start)
  const items: SessionLog[] = Array.from({ length: count }, (_, index) => {
    const id = start + index + 1
    return { ...endedLog, id, pcName: `PC-${String(id).padStart(2, '0')}` }
  })
  const body: SessionLogPage = { items, totalItems, page, pageSize: 10 }
  return Response.json(body)
}

type Responder = (url: URL, init?: RequestInit) => Response | Promise<Response>

// The PC list is served for every test; anything else unrouted fails visibly instead of hanging.
function stubFetch(respond: Responder) {
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(String(input), 'http://localhost')
    if (url.pathname === PCS_PATH) return Promise.resolve(Response.json(PCS))
    return Promise.resolve(respond(url, init))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function listOnly(body: SessionLogPage): Responder {
  return (url) => (url.pathname === LIST_PATH ? Response.json(body) : unexpected(url))
}

function unexpected(url: URL): Response {
  return Response.json({ error: `Unexpected request: ${url.pathname}` }, { status: 500 })
}

function renderLogsPage(initialPath = '/logs', notify: Notify = vi.fn()) {
  return render(
    <TestProviders initialPath={initialPath} notify={notify}>
      <LogsPage />
    </TestProviders>,
  )
}

function requestedUrls(fetchMock: ReturnType<typeof stubFetch>, pathname = LIST_PATH): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), 'http://localhost'))
    .filter((url) => url.pathname === pathname)
}

function lastListSearch(fetchMock: ReturnType<typeof stubFetch>): string | undefined {
  return requestedUrls(fetchMock).at(-1)?.search
}

function pcSelect(): HTMLSelectElement {
  return screen.getByLabelText('PC') as HTMLSelectElement
}

describe('LogsPage', () => {
  beforeEach(() => {
    vi.mocked(saveBlobAsFile).mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the sessions from the server with their end reasons and a count', async () => {
    stubFetch(
      listOnly({ items: [runningLog, endedLog], totalItems: 2, page: 1, pageSize: 10 }),
    )
    renderLogsPage()

    expect(await screen.findByText('PC-07')).toBeTruthy()
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.getByText('Time expired')).toBeTruthy()
    expect(screen.getByText('Login request')).toBeTruthy()
    expect(screen.getByText(/Showing 1–2 of 2 sessions · server time/)).toBeTruthy()
  })

  it('asks for the first page of every session when no filters are set', async () => {
    const fetchMock = stubFetch((url) => listPage(url))
    renderLogsPage()

    await screen.findByText('PC-01')
    expect(requestedUrls(fetchMock)[0]?.search).toBe('?page=1&pageSize=10')
  })

  it('shows the empty message when no sessions match', async () => {
    stubFetch(listOnly({ items: [], totalItems: 0, page: 1, pageSize: 10 }))
    renderLogsPage()

    expect(await screen.findByText('No sessions match these filters.')).toBeTruthy()
    expect(screen.getByText(/Showing 0–0 of 0 sessions/)).toBeTruthy()
  })

  it('shows the loading state until the first page arrives', async () => {
    stubFetch(() => new Promise<Response>(() => {}))
    renderLogsPage()

    expect(await screen.findByText('Loading sessions...')).toBeTruthy()
  })

  it('shows the server error and retries when Try again is pressed', async () => {
    let attempt = 0
    stubFetch((url) => {
      if (url.pathname !== LIST_PATH) return unexpected(url)
      attempt += 1
      if (attempt === 1) return Response.json({ error: 'Database is down.' }, { status: 500 })
      return listPage(url)
    })
    renderLogsPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Database is down.')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('PC-01')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  describe('filters', () => {
    it('lists every registered PC by name after All PCs', async () => {
      stubFetch((url) => listPage(url))
      renderLogsPage()

      await waitFor(() => expect(pcSelect().options).toHaveLength(4))
      expect(Array.from(pcSelect().options).map((option) => option.text)).toEqual([
        'All PCs',
        'PC-1',
        'PC-2',
        'PC-10',
      ])
    })

    it('shows one day for one PC and goes back to page 1', async () => {
      const fetchMock = stubFetch((url) => listPage(url))
      renderLogsPage()
      await screen.findByText('PC-01')
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      await screen.findByText('Page 2 of 3')

      fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'day' } })
      fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-11-08' } })
      await waitFor(() => expect(pcSelect().options).toHaveLength(4))
      fireEvent.change(pcSelect(), { target: { value: '2' } })
      fireEvent.change(screen.getByLabelText('User'), { target: { value: 'lab' } })
      fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

      await waitFor(() =>
        expect(lastListSearch(fetchMock)).toBe(
          '?from=2026-11-08&to=2026-11-08&user=lab&pcId=2&page=1&pageSize=10',
        ),
      )
      expect(await screen.findByText('Page 1 of 3')).toBeTruthy()
    })

    it('shows a whole month from the 1st to its last day', async () => {
      const fetchMock = stubFetch((url) => listPage(url))
      renderLogsPage()
      await screen.findByText('PC-01')

      fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'month' } })
      fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-02' } })
      fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

      await waitFor(() =>
        expect(lastListSearch(fetchMock)).toBe('?from=2026-02-01&to=2026-02-28&page=1&pageSize=10'),
      )
    })

    it('only shows the picker for the chosen period', async () => {
      stubFetch((url) => listPage(url))
      renderLogsPage()
      await screen.findByText('PC-01')

      expect(screen.queryByLabelText('Day')).toBeNull()
      expect(screen.queryByLabelText('Month')).toBeNull()

      fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'day' } })
      expect(screen.getByLabelText('Day')).toBeTruthy()
      expect(screen.queryByLabelText('Month')).toBeNull()
    })

    it('clears the filters and reloads every session', async () => {
      const fetchMock = stubFetch((url) => listPage(url))
      renderLogsPage('/logs?pcId=2&pcName=PC-2')
      await screen.findByText('PC-01')
      fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'month' } })

      fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

      await waitFor(() => expect(lastListSearch(fetchMock)).toBe('?page=1&pageSize=10'))
      expect(pcSelect().value).toBe('')
      expect((screen.getByLabelText('Show') as HTMLSelectElement).value).toBe('all')
      expect(screen.getByRole('link', { name: 'Back to dashboard' })).toBeTruthy()
    })
  })

  describe('opened from View history', () => {
    it('selects that PC and asks only for it', async () => {
      const fetchMock = stubFetch((url) => listPage(url))
      renderLogsPage('/logs?pcId=1&pcName=PC-1')

      expect(await screen.findByRole('link', { name: 'Back to dashboard' })).toBeTruthy()
      await waitFor(() => expect(requestedUrls(fetchMock)[0]?.search).toBe('?pcId=1&page=1&pageSize=10'))
      await waitFor(() => expect(pcSelect().selectedOptions[0]?.text).toBe('PC-1'))
    })

    it('still offers a removed PC under the name from the link', async () => {
      stubFetch((url) => listPage(url))
      renderLogsPage('/logs?pcId=99&pcName=Old-PC')

      await waitFor(() => expect(pcSelect().selectedOptions[0]?.text).toBe('Old-PC'))
    })

    it('exports only that PC', async () => {
      const fetchMock = stubFetch((url) =>
        url.pathname === EXPORT_PATH ? new Response('id\n') : listPage(url),
      )
      renderLogsPage('/logs?pcId=1&pcName=PC-1')
      await screen.findByText('PC-01')

      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

      await waitFor(() => expect(saveBlobAsFile).toHaveBeenCalledTimes(1))
      expect(requestedUrls(fetchMock, EXPORT_PATH)[0]?.search).toBe('?pcId=1')
    })
  })

  describe('purge old logs', () => {
    function purgeRoutes(count: number, deleted = count): Responder {
      return (url, init) => {
        if (url.pathname === PURGE_PREVIEW_PATH) return Response.json({ count })
        if (url.pathname === PURGE_PATH && init?.method === 'POST') return Response.json({ deleted })
        return listPage(url)
      }
    }

    function openPurge() {
      fireEvent.click(screen.getByRole('button', { name: 'Purge old logs' }))
      const dialog = screen.getByRole('heading', { name: 'Purge old logs' }).closest('dialog')
      if (!dialog) throw new Error('The purge dialog is not open')
      return dialog
    }

    it('shows how many sessions a choice deletes before anything is deleted', async () => {
      const fetchMock = stubFetch(purgeRoutes(12))
      renderLogsPage()
      await screen.findByText('PC-01')

      const dialog = openPurge()

      expect(
        await within(dialog).findByText(
          "This deletes 12 sessions on all PCs that started more than 90 days ago, whatever the filters show. Running sessions are kept. This can't be undone.",
        ),
      ).toBeTruthy()
      expect(requestedUrls(fetchMock, PURGE_PREVIEW_PATH)[0]?.search).toBe('?olderThanDays=90')

      fireEvent.change(within(dialog).getByLabelText('Delete ended sessions on all PCs older than'), {
        target: { value: '365' },
      })
      await waitFor(() =>
        expect(requestedUrls(fetchMock, PURGE_PREVIEW_PATH).at(-1)?.search).toBe('?olderThanDays=365'),
      )
      expect(requestedUrls(fetchMock, PURGE_PATH)).toHaveLength(0)
    })

    it('deletes, says how many, closes and reloads the list', async () => {
      const fetchMock = stubFetch(purgeRoutes(12))
      const notify = vi.fn()
      renderLogsPage('/logs', notify)
      await screen.findByText('PC-01')
      const listRequestsBefore = requestedUrls(fetchMock).length

      const dialog = openPurge()
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Delete 12 sessions' }))

      await waitFor(() => expect(notify).toHaveBeenCalledWith('Deleted 12 sessions.'))
      const purgeCall = fetchMock.mock.calls.find(([input]) => String(input) === PURGE_PATH)
      expect(purgeCall?.[1]?.body).toBe(JSON.stringify({ olderThanDays: 90 }))
      expect(screen.queryByRole('heading', { name: 'Purge old logs' })).toBeNull()
      await waitFor(() => expect(requestedUrls(fetchMock).length).toBeGreaterThan(listRequestsBefore))
    })

    it('cannot delete when nothing is old enough', async () => {
      stubFetch(purgeRoutes(0))
      renderLogsPage()
      await screen.findByText('PC-01')

      const dialog = openPurge()

      expect(await within(dialog).findByText('No ended sessions started more than 90 days ago.')).toBeTruthy()
      expect((within(dialog).getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('shows the server error and keeps the dialog open when the delete fails', async () => {
      stubFetch((url, init) => {
        if (url.pathname === PURGE_PREVIEW_PATH) return Response.json({ count: 3 })
        if (url.pathname === PURGE_PATH && init?.method === 'POST') {
          return Response.json({ error: 'Database is busy.' }, { status: 500 })
        }
        return listPage(url)
      })
      const notify = vi.fn()
      renderLogsPage('/logs', notify)
      await screen.findByText('PC-01')

      const dialog = openPurge()
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Delete 3 sessions' }))

      expect((await within(dialog).findByRole('alert')).textContent).toBe('Database is busy.')
      expect(notify).not.toHaveBeenCalled()
    })

    it('closes without deleting when Cancel is pressed', async () => {
      const fetchMock = stubFetch(purgeRoutes(5))
      renderLogsPage()
      await screen.findByText('PC-01')

      const dialog = openPurge()
      await within(dialog).findByRole('button', { name: 'Delete 5 sessions' })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('heading', { name: 'Purge old logs' })).toBeNull()
      expect(requestedUrls(fetchMock, PURGE_PATH)).toHaveLength(0)
    })
  })

  describe('export', () => {
    it('downloads the CSV for the applied filters', async () => {
      const fetchMock = stubFetch((url) => {
        if (url.pathname === EXPORT_PATH) {
          return new Response('id\n1\n', {
            headers: { 'Content-Disposition': 'attachment; filename="session-logs.csv"' },
          })
        }
        return listPage(url)
      })
      const notify = vi.fn()
      renderLogsPage('/logs', notify)
      await screen.findByText('PC-01')
      fireEvent.change(screen.getByLabelText('User'), { target: { value: 'lab' } })
      fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
      await waitFor(() => expect(lastListSearch(fetchMock)).toContain('user=lab'))

      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

      await waitFor(() => expect(saveBlobAsFile).toHaveBeenCalledTimes(1))
      expect(requestedUrls(fetchMock, EXPORT_PATH)[0]?.search).toBe('?user=lab')
      expect(saveBlobAsFile).toHaveBeenCalledWith(expect.any(Blob), 'session-logs.csv')
      expect(notify).not.toHaveBeenCalled()
    })

    it('disables the button and shows Exporting... while the file is being prepared', async () => {
      let finishExport: (response: Response) => void = () => {}
      stubFetch((url) => {
        if (url.pathname === EXPORT_PATH) {
          return new Promise<Response>((done) => {
            finishExport = done
          })
        }
        return listPage(url)
      })
      renderLogsPage()
      await screen.findByText('PC-01')

      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

      const exporting = await screen.findByRole('button', { name: 'Exporting...' })
      expect((exporting as HTMLButtonElement).disabled).toBe(true)

      await act(async () => {
        finishExport(new Response('id\n', { headers: { 'Content-Disposition': 'attachment; filename="a.csv"' } }))
      })
      expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeTruthy()
    })

    it('says the export was capped when the server truncated it', async () => {
      stubFetch((url) => {
        if (url.pathname === EXPORT_PATH) {
          return new Response('id\n', { headers: { 'X-Export-Truncated': 'true' } })
        }
        return listPage(url)
      })
      renderLogsPage()
      await screen.findByText('PC-01')

      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

      expect(await screen.findByText('Exported the newest 10,000 sessions.')).toBeTruthy()
    })

    it('shows a notification when the export fails', async () => {
      stubFetch((url) => {
        if (url.pathname === EXPORT_PATH) {
          return Response.json({ error: 'to must be a date.' }, { status: 400 })
        }
        return listPage(url)
      })
      const notify = vi.fn()
      renderLogsPage('/logs', notify)
      await screen.findByText('PC-01')

      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

      await waitFor(() => expect(notify).toHaveBeenCalledWith('to must be a date.', 'alert'))
      expect(saveBlobAsFile).not.toHaveBeenCalled()
    })
  })
})
