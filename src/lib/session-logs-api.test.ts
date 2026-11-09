import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE, NETWORK_ERROR_STATUS } from './api'
import { saveBlobAsFile } from './file-download'
import {
  exportSessionLogs,
  listSessionLogs,
  parseExportFilename,
  SESSION_LOG_PAGE_SIZE,
} from './session-logs-api'

vi.mock('./file-download', () => ({ saveBlobAsFile: vi.fn() }))

const LIST_PATH = '/api/session-logs'
const EXPORT_PATH = '/api/session-logs/export'

const runningItem = {
  id: 7,
  pcName: 'PC-07',
  userOrSource: 'lab-pc07',
  source: 'account',
  startedAt: '2026-11-09T08:45:00+02:00',
  endedAt: null,
  durationMinutes: 12,
  endReason: null,
}

const endedItem = {
  id: 6,
  pcName: 'PC-06',
  userOrSource: 'Login request',
  source: 'login-request',
  startedAt: '2026-11-08T09:52:00+02:00',
  endedAt: '2026-11-08T10:52:00+02:00',
  durationMinutes: 60,
  endReason: 'time-expired',
}

const listBody = {
  items: [runningItem, endedItem],
  totalItems: 12,
  page: 2,
  pageSize: 10,
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn((_input: string, _init?: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function requestedUrl(fetchMock: ReturnType<typeof stubFetch>): URL {
  const [input] = fetchMock.mock.calls[0] ?? []
  return new URL(String(input), 'http://localhost')
}

describe('listSessionLogs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('query building', () => {
    it('asks for the page at the fixed page size with no filters', async () => {
      const fetchMock = stubFetch(Response.json(listBody))
      await listSessionLogs({}, 2)

      expect(fetchMock.mock.calls[0]?.[0]).toBe(`${LIST_PATH}?page=2&pageSize=${SESSION_LOG_PAGE_SIZE}`)
    })

    it('sends every non-empty filter and trims the values', async () => {
      const fetchMock = stubFetch(Response.json(listBody))
      await listSessionLogs({ from: ' 2026-11-01 ', to: '2026-11-04', pc: ' PC-05 ', user: 'lab' }, 1)

      const url = requestedUrl(fetchMock)
      expect(url.searchParams.get('from')).toBe('2026-11-01')
      expect(url.searchParams.get('to')).toBe('2026-11-04')
      expect(url.searchParams.get('pc')).toBe('PC-05')
      expect(url.searchParams.get('user')).toBe('lab')
      expect(url.searchParams.get('page')).toBe('1')
      expect(url.searchParams.get('pageSize')).toBe(String(SESSION_LOG_PAGE_SIZE))
    })

    it('omits filters that are empty or only spaces', async () => {
      const fetchMock = stubFetch(Response.json(listBody))
      await listSessionLogs({ from: '', to: '  ', pc: '', user: undefined }, 1)

      const url = requestedUrl(fetchMock)
      expect(url.searchParams.has('from')).toBe(false)
      expect(url.searchParams.has('to')).toBe(false)
      expect(url.searchParams.has('pc')).toBe(false)
      expect(url.searchParams.has('user')).toBe(false)
    })

    it('sends same-origin credentials', async () => {
      const fetchMock = stubFetch(Response.json(listBody))
      await listSessionLogs({}, 1)

      expect(fetchMock.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({ credentials: 'same-origin' }),
      )
    })
  })

  describe('response parsing', () => {
    it('returns the page as the server sent it', async () => {
      stubFetch(Response.json(listBody))
      expect(await listSessionLogs({}, 2)).toEqual({
        success: true,
        data: {
          items: [runningItem, endedItem],
          totalItems: 12,
          page: 2,
          pageSize: 10,
        },
      })
    })

    it('shows an unknown source as an account instead of failing the list', async () => {
      stubFetch(
        Response.json({
          ...listBody,
          items: [{ ...endedItem, source: 'scheduled-job' }],
        }),
      )
      const result = await listSessionLogs({}, 1)

      expect(result.success && result.data.items[0]?.source).toBe('account')
    })

    it('shows an unknown end reason as Other instead of failing the list', async () => {
      stubFetch(
        Response.json({
          ...listBody,
          items: [{ ...endedItem, endReason: 'disk-full' }],
        }),
      )
      const result = await listSessionLogs({}, 1)

      expect(result.success && result.data.items[0]?.endReason).toBe('unknown')
    })

    it('keeps a null end reason as null', async () => {
      stubFetch(Response.json({ ...listBody, items: [{ ...endedItem, endReason: null }] }))
      const result = await listSessionLogs({}, 1)

      expect(result.success && result.data.items[0]?.endReason).toBeNull()
    })

    it('fails with the fallback message when the body does not match the contract', async () => {
      stubFetch(Response.json({ items: 'nope' }))
      expect(await listSessionLogs({}, 1)).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })
  })

  describe('errors', () => {
    it('returns the server message for a bad filter', async () => {
      stubFetch(Response.json({ error: 'pc must be 64 characters or fewer.' }, { status: 400 }))
      expect(await listSessionLogs({ pc: 'x'.repeat(65) }, 1)).toEqual({
        success: false,
        status: 400,
        error: 'pc must be 64 characters or fewer.',
      })
    })

    it('returns the network message when the server cannot be reached', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await listSessionLogs({}, 1)).toEqual({
        success: false,
        status: NETWORK_ERROR_STATUS,
        error: NETWORK_ERROR_MESSAGE,
      })
    })
  })
})

describe('exportSessionLogs', () => {
  beforeEach(() => {
    vi.mocked(saveBlobAsFile).mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function csvResponse(headers: Record<string, string> = {}) {
    return new Response('id,pc\n1,PC-01\n', {
      status: 200,
      headers: { 'Content-Type': 'text/csv', ...headers },
    })
  }

  it('requests the export with the same filters and no paging', async () => {
    const fetchMock = stubFetch(csvResponse())
    await exportSessionLogs({ from: '2026-11-01', pc: 'PC-05' })

    const url = requestedUrl(fetchMock)
    expect(url.pathname).toBe(EXPORT_PATH)
    expect(url.searchParams.get('from')).toBe('2026-11-01')
    expect(url.searchParams.get('pc')).toBe('PC-05')
    expect(url.searchParams.has('page')).toBe(false)
    expect(url.searchParams.has('pageSize')).toBe(false)
  })

  it('requests the bare export path when no filters are set', async () => {
    const fetchMock = stubFetch(csvResponse())
    await exportSessionLogs({})

    expect(fetchMock.mock.calls[0]?.[0]).toBe(EXPORT_PATH)
  })

  it('saves the CSV under the filename from Content-Disposition', async () => {
    stubFetch(csvResponse({ 'Content-Disposition': 'attachment; filename="session-logs-2026-11-09.csv"' }))
    await exportSessionLogs({})

    expect(saveBlobAsFile).toHaveBeenCalledWith(expect.any(Blob), 'session-logs-2026-11-09.csv')
  })

  it('reports a complete export as not truncated', async () => {
    stubFetch(csvResponse())
    expect(await exportSessionLogs({})).toEqual({ success: true, data: { isTruncated: false } })
  })

  it('reports an export capped at 10,000 rows as truncated', async () => {
    stubFetch(csvResponse({ 'X-Export-Truncated': 'true' }))
    expect(await exportSessionLogs({})).toEqual({ success: true, data: { isTruncated: true } })
  })

  it('returns the server message and does not save a file on an error response', async () => {
    stubFetch(Response.json({ error: 'from must be a date.' }, { status: 400 }))
    expect(await exportSessionLogs({ from: 'nope' })).toEqual({
      success: false,
      status: 400,
      error: 'from must be a date.',
    })
    expect(saveBlobAsFile).not.toHaveBeenCalled()
  })

  it('uses the fallback message when an error response has no JSON body', async () => {
    stubFetch(new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await exportSessionLogs({})).toEqual({
      success: false,
      status: 502,
      error: FALLBACK_ERROR_MESSAGE,
    })
  })

  it('returns the network message when the server cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    expect(await exportSessionLogs({})).toEqual({
      success: false,
      status: NETWORK_ERROR_STATUS,
      error: NETWORK_ERROR_MESSAGE,
    })
    expect(saveBlobAsFile).not.toHaveBeenCalled()
  })
})

describe('parseExportFilename', () => {
  it('reads a quoted filename', () => {
    expect(parseExportFilename('attachment; filename="session-logs-2026-11-09.csv"')).toBe(
      'session-logs-2026-11-09.csv',
    )
  })

  it('reads an unquoted filename', () => {
    expect(parseExportFilename('attachment; filename=logs.csv')).toBe('logs.csv')
  })

  it('decodes an RFC 5987 filename', () => {
    expect(parseExportFilename("attachment; filename*=UTF-8''session%20logs.csv")).toBe(
      'session logs.csv',
    )
  })

  it('keeps only the last path segment of the filename', () => {
    expect(parseExportFilename('attachment; filename="..\\..\\etc/logs.csv"')).toBe('logs.csv')
  })

  it('falls back to the default name when there is no filename', () => {
    expect(parseExportFilename(null)).toBe('session-logs.csv')
    expect(parseExportFilename('attachment')).toBe('session-logs.csv')
    expect(parseExportFilename('attachment; filename=""')).toBe('session-logs.csv')
  })

  it('keeps an undecodable filename as it was sent', () => {
    expect(parseExportFilename("attachment; filename*=UTF-8''%E0%A4%A.csv")).toBe('%E0%A4%A.csv')
  })
})
