import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from './api'
import { listPcs, lockAllPcs, lockPc, removePc, unlockAllPcs, unlockPc } from './pcs-api'

const serverPc = {
  id: 3,
  name: 'PC-03',
  isOnline: true,
  ipAddress: '192.168.1.13',
  registeredAt: '2026-11-01T08:00:00.000Z',
  lastSeenAt: '2026-11-05T10:00:00.000Z',
  session: null,
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('pcs api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('listPcs', () => {
    it('gets the registered PCs', async () => {
      const fetchMock = stubFetch(Response.json([serverPc, { ...serverPc, id: 4, ipAddress: null }]))
      expect(await listPcs()).toEqual({
        success: true,
        data: [serverPc, { ...serverPc, id: 4, ipAddress: null }],
      })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs',
        expect.objectContaining({ method: 'GET', headers: undefined }),
      )
    })

    it('marks background requests with the refresh header', async () => {
      const fetchMock = stubFetch(Response.json([]))
      await listPcs({ isBackground: true })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs',
        expect.objectContaining({ headers: { 'X-Background-Refresh': '1' } }),
      )
    })

    it('drops fields the server sends beyond the contract', async () => {
      stubFetch(Response.json([{ ...serverPc, token: 'secret' }]))
      expect(await listPcs()).toEqual({ success: true, data: [serverPc] })
    })

    it('keeps a timed session', async () => {
      const session = {
        username: 'maria',
        startedAt: '2026-11-05T09:00:00.000Z',
        time: { mode: 'time-limit', minutes: 60 },
        secondsRemaining: 1800,
      }
      stubFetch(Response.json([{ ...serverPc, session }]))
      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, session }] })
    })

    it('keeps an open time session with no seconds remaining', async () => {
      const session = {
        username: 'maria',
        startedAt: '2026-11-05T09:00:00.000Z',
        time: { mode: 'open-time' },
        secondsRemaining: null,
      }
      stubFetch(Response.json([{ ...serverPc, session }]))
      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, session }] })
    })

    it('keeps an admin unlock session with no username', async () => {
      const session = {
        username: null,
        startedAt: '2026-11-05T09:00:00.000Z',
        time: { mode: 'open-time' },
        secondsRemaining: null,
      }
      stubFetch(Response.json([{ ...serverPc, session }]))
      expect(await listPcs()).toEqual({ success: true, data: [{ ...serverPc, session }] })
    })

    it.each([
      ['a missing username', { startedAt: 'x', time: { mode: 'open-time' }, secondsRemaining: null }],
      ['an unknown time mode', { username: 'a', startedAt: 'x', time: { mode: 'forever' }, secondsRemaining: null }],
      ['text seconds remaining', { username: 'a', startedAt: 'x', time: { mode: 'open-time' }, secondsRemaining: '5' }],
    ])('fails on a malformed session with %s', async (_label, session) => {
      stubFetch(Response.json([{ ...serverPc, session }]))
      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })
    })

    it('fails when the session field is missing', async () => {
      const { session: _session, ...withoutSession } = serverPc
      stubFetch(Response.json([withoutSession]))
      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })
    })

    it('fails with the fallback message on a malformed body', async () => {
      stubFetch(Response.json([{ ...serverPc, isOnline: 'yes' }]))
      expect(await listPcs()).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('fails when the body is not a list', async () => {
      stubFetch(Response.json({ pcs: [serverPc] }))
      expect(await listPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })
    })

    it('returns the status and message of an error response', async () => {
      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))
      expect(await listPcs()).toEqual({ success: false, status: 401, error: 'Sign in again.' })
    })
  })

  describe('removePc', () => {
    it('deletes the PC by id', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await removePc(7)).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/7',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it.each([404, 409])('returns the server message on %i', async (status) => {
      stubFetch(Response.json({ error: 'Nope.' }, { status }))
      expect(await removePc(7)).toEqual({ success: false, status, error: 'Nope.' })
    })
  })

  describe('lockPc and unlockPc', () => {
    it('posts an empty body to the lock route of the PC', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await lockPc(7)).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/7/lock',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      )
    })

    it('posts to the unlock route of the PC', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await unlockPc(7)).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/7/unlock',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      )
    })

    it.each([404, 409])('returns the server message on %i', async (status) => {
      stubFetch(Response.json({ error: 'This PC is offline.' }, { status }))
      expect(await unlockPc(7)).toEqual({ success: false, status, error: 'This PC is offline.' })
    })
  })

  describe('lockAllPcs and unlockAllPcs', () => {
    it('returns how many PCs were locked', async () => {
      const fetchMock = stubFetch(Response.json({ affected: 8 }))
      expect(await lockAllPcs()).toEqual({ success: true, data: { affected: 8 } })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/lock-all',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      )
    })

    it('returns how many PCs were unlocked', async () => {
      const fetchMock = stubFetch(Response.json({ affected: 0 }))
      expect(await unlockAllPcs()).toEqual({ success: true, data: { affected: 0 } })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/unlock-all',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      )
    })

    it('fails on a count that is not a whole number of PCs', async () => {
      stubFetch(Response.json({ affected: -1 }))
      expect(await unlockAllPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })
    })

    it('fails when the response has no count', async () => {
      stubFetch(Response.json({ count: 3 }))
      expect(await lockAllPcs()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })
    })

    it('returns the server message when the request fails', async () => {
      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))
      expect(await lockAllPcs()).toEqual({ success: false, status: 401, error: 'Sign in again.' })
    })
  })
})
