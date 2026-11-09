import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from './api'
import {
  approveLoginRequest,
  denyLoginRequest,
  denyLoginRequests,
  listLoginRequests,
} from './requests-api'

const pendingEntry = {
  id: 4,
  pcName: 'PC-04',
  requestedAt: '2026-11-05T10:00:00.000Z',
  status: 'pending',
  decidedAt: null,
}

const approvedEntry = {
  ...pendingEntry,
  status: 'approved',
  time: { mode: 'time-limit', minutes: 60 },
  decidedAt: '2026-11-05T10:05:00.000Z',
}

const deniedEntry = {
  ...pendingEntry,
  id: 5,
  status: 'denied',
  decidedAt: '2026-11-05T10:06:00.000Z',
}

const cancelledEntry = {
  ...pendingEntry,
  id: 6,
  status: 'cancelled',
  reason: 'logged-in',
  decidedAt: '2026-11-05T10:07:00.000Z',
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('login requests api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('listLoginRequests', () => {
    it('gets both lists', async () => {
      const fetchMock = stubFetch(
        Response.json({ pending: [pendingEntry], history: [approvedEntry] }),
      )
      expect(await listLoginRequests()).toEqual({
        success: true,
        data: { pending: [pendingEntry], history: [approvedEntry] },
      })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/login-requests',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('fails with the fallback message when a list is missing', async () => {
      stubFetch(Response.json({ pending: [] }))
      expect(await listLoginRequests()).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('fails on an unknown status', async () => {
      stubFetch(Response.json({ pending: [{ ...pendingEntry, status: 'maybe' }], history: [] }))
      expect(await listLoginRequests()).toMatchObject({ success: false })
    })

    it('fails on an unknown time mode', async () => {
      stubFetch(
        Response.json({ pending: [], history: [{ ...approvedEntry, time: { mode: 'forever' } }] }),
      )
      expect(await listLoginRequests()).toMatchObject({ success: false })
    })

    it('accepts a cancelled request with a known reason', async () => {
      stubFetch(Response.json({ pending: [], history: [cancelledEntry] }))
      expect(await listLoginRequests()).toEqual({
        success: true,
        data: { pending: [], history: [cancelledEntry] },
      })
    })

    it('keeps a known reason on a denied request', async () => {
      const offlineEntry = { ...deniedEntry, reason: 'pc-offline' }
      stubFetch(Response.json({ pending: [], history: [offlineEntry] }))
      const result = await listLoginRequests()
      expect(result).toEqual({ success: true, data: { pending: [], history: [offlineEntry] } })
    })

    it('drops a reason it does not know without failing the list', async () => {
      stubFetch(
        Response.json({
          pending: [],
          history: [{ ...deniedEntry, reason: 'pc-on-fire' }, cancelledEntry],
        }),
      )
      const result = await listLoginRequests()
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.history[0]?.reason).toBeUndefined()
      expect(result.data.history[1]).toEqual(cancelledEntry)
    })

    it('drops a null reason', async () => {
      stubFetch(Response.json({ pending: [], history: [{ ...deniedEntry, reason: null }] }))
      const result = await listLoginRequests()
      expect(result).toEqual({ success: true, data: { pending: [], history: [deniedEntry] } })
    })

    it('still fails on a status it does not know', async () => {
      stubFetch(Response.json({ pending: [], history: [{ ...deniedEntry, status: 'expired' }] }))
      expect(await listLoginRequests()).toMatchObject({ success: false })
    })

    it('sends the background header only when polling', async () => {
      const fetchMock = stubFetch(Response.json({ pending: [], history: [] }))
      await listLoginRequests({ isBackground: true })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/login-requests',
        expect.objectContaining({ headers: { 'X-Background-Refresh': '1' } }),
      )
    })

    it('strips fields the schema does not name', async () => {
      stubFetch(Response.json({ pending: [{ ...pendingEntry, secret: 'internal' }], history: [] }))
      const result = await listLoginRequests()
      expect(result).toEqual({ success: true, data: { pending: [pendingEntry], history: [] } })
      expect(JSON.stringify(result)).not.toContain('internal')
    })

    it('passes through a 401 with its status', async () => {
      stubFetch(Response.json({ error: 'Session expired.' }, { status: 401 }))
      expect(await listLoginRequests()).toEqual({
        success: false,
        status: 401,
        error: 'Session expired.',
      })
    })
  })

  describe('approveLoginRequest', () => {
    it('posts a time limit to the approve path', async () => {
      const fetchMock = stubFetch(Response.json(approvedEntry))
      const time = { mode: 'time-limit', minutes: 60 } as const
      expect(await approveLoginRequest(4, time)).toEqual({ success: true, data: approvedEntry })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/login-requests/4/approve',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ time }) }),
      )
    })

    it('posts open time', async () => {
      const fetchMock = stubFetch(Response.json({ ...approvedEntry, time: { mode: 'open-time' } }))
      await approveLoginRequest(4, { mode: 'open-time' })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/login-requests/4/approve',
        expect.objectContaining({ body: '{"time":{"mode":"open-time"}}' }),
      )
    })

    it('strips extra fields from the entry', async () => {
      stubFetch(Response.json({ ...approvedEntry, secret: 'internal' }))
      const result = await approveLoginRequest(4, { mode: 'open-time' })
      expect(result).toEqual({ success: true, data: approvedEntry })
      expect(JSON.stringify(result)).not.toContain('internal')
    })

    it('reports a malformed body', async () => {
      stubFetch(Response.json({ id: 'x' }))
      expect(await approveLoginRequest(4, { mode: 'open-time' })).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('returns the 409 message when already decided', async () => {
      stubFetch(Response.json({ error: 'Already decided.' }, { status: 409 }))
      expect(await approveLoginRequest(4, { mode: 'open-time' })).toEqual({
        success: false,
        status: 409,
        error: 'Already decided.',
      })
    })

    it('returns the server message when the PC is offline', async () => {
      const message = 'That PC is offline, so the request was closed.'
      stubFetch(Response.json({ error: message }, { status: 409 }))
      expect(await approveLoginRequest(4, { mode: 'open-time' })).toEqual({
        success: false,
        status: 409,
        error: message,
      })
    })
  })

  describe('denyLoginRequest', () => {
    it('posts an empty JSON body to the deny path', async () => {
      const fetchMock = stubFetch(Response.json(deniedEntry))
      expect(await denyLoginRequest(5)).toEqual({ success: true, data: deniedEntry })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/login-requests/5/deny',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      )
    })

    it('returns a 404 failure', async () => {
      stubFetch(Response.json({ error: 'Request not found.' }, { status: 404 }))
      expect(await denyLoginRequest(5)).toMatchObject({ success: false, status: 404 })
    })

    it('fails on a malformed body', async () => {
      stubFetch(Response.json([]))
      expect(await denyLoginRequest(5)).toMatchObject({ success: false })
    })
  })

  describe('denyLoginRequests', () => {
    it('posts the ids and returns the denied entries', async () => {
      const fetchMock = stubFetch(Response.json({ denied: [deniedEntry] }))
      expect(await denyLoginRequests([4, 5])).toEqual({ success: true, data: [deniedEntry] })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/login-requests/deny-all',
        expect.objectContaining({ method: 'POST', body: '{"ids":[4,5]}' }),
      )
    })

    it('accepts an empty denied list', async () => {
      stubFetch(Response.json({ denied: [] }))
      expect(await denyLoginRequests([4])).toEqual({ success: true, data: [] })
    })

    it('fails on a malformed body', async () => {
      stubFetch(Response.json({ denied: 'all' }))
      expect(await denyLoginRequests([4])).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('returns a 400 failure', async () => {
      stubFetch(Response.json({ error: 'Bad ids.' }, { status: 400 }))
      expect(await denyLoginRequests([])).toMatchObject({ success: false, status: 400 })
    })

    it('returns a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await denyLoginRequests([4])).toMatchObject({ success: false, status: 0 })
    })
  })
})
