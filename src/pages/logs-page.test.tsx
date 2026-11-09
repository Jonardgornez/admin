// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notify } from '../component/ui/notification-context'
import { saveBlobAsFile } from '../lib/file-download'
import { TestProviders } from '../test/test-providers'
import type { SessionLog, SessionLogPage } from '../types'
import { LogsPage } from './logs-page'

vi.mock('../lib/file-download', () => ({ saveBlobAsFile: vi.fn() }))

const LIST_PATH = '/api/session-logs'
const EXPORT_PATH = '/api/session-logs/export'

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

// Anything unrouted fails the test visibly instead of hanging on an undefined response.
function stubFetch(respond: Responder) {
  const fetchMock = vi.fn<typeof fetch>((input, init) =>
    Promise.resolve(respond(new URL(String(input), 'http://localhost'), init)),
  )
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

function requestedUrls(fetchMock: ReturnType<typeof stubFetch>): URL[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), 'http://localhost'))
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

  it('sends the applied filters and goes back to page 1', async () => {
    const fetchMock = stubFetch((url) => listPage(url))
    renderLogsPage()
    await screen.findByText('PC-01')

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('PC-11')
    expect(screen.getByText('Page 2 of 3')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('PC'), { target: { value: 'pc-05' } })
    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'lab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => expect(requestedUrls(fetchMock).at(-1)?.search).toBe(
      '?from=2026-11-01&pc=pc-05&user=lab&page=1&pageSize=10',
    ))
    expect(await screen.findByText('Page 1 of 3')).toBeTruthy()
  })

  it('clears the filters and reloads every session', async () => {
    const fetchMock = stubFetch((url) => listPage(url))
    renderLogsPage('/logs?pc=PC-05')
    await screen.findByText('PC-01')

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(requestedUrls(fetchMock).at(-1)?.search).toBe('?page=1&pageSize=10'))
    expect((screen.getByLabelText('PC') as HTMLInputElement).value).toBe('')
  })

  it('prefills the PC filter from the URL and offers a way back to the dashboard', async () => {
    const fetchMock = stubFetch((url) => listPage(url))
    renderLogsPage('/logs?pc=PC-05')

    expect(await screen.findByRole('link', { name: 'Back to dashboard' })).toBeTruthy()
    expect((screen.getByLabelText('PC') as HTMLInputElement).value).toBe('PC-05')
    await waitFor(() => expect(requestedUrls(fetchMock)[0]?.search).toBe('?pc=PC-05&page=1&pageSize=10'))
  })

  it('keeps Purge old logs disabled and says why', () => {
    stubFetch(listOnly({ items: [], totalItems: 0, page: 1, pageSize: 10 }))
    renderLogsPage()

    const purge = screen.getByRole('button', { name: 'Purge old logs' }) as HTMLButtonElement
    expect(purge.disabled).toBe(true)
    expect(purge.title).toBe('Not available yet')
    const hint = document.getElementById(purge.getAttribute('aria-describedby') ?? '')
    expect(hint?.textContent).toBe('Not available yet')
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
      renderLogsPage('/logs?pc=PC-05', notify)
      await screen.findByText('PC-01')

      fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

      await waitFor(() => expect(saveBlobAsFile).toHaveBeenCalledTimes(1))
      const exportUrl = requestedUrls(fetchMock).find((url) => url.pathname === EXPORT_PATH)
      expect(exportUrl?.search).toBe('?pc=PC-05')
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
