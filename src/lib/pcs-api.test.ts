import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from './api'
import { listPcs, removePc } from './pcs-api'

const serverPc = {
  id: 3,
  name: 'PC-03',
  isOnline: true,
  ipAddress: '192.168.1.13',
  registeredAt: '2026-11-01T08:00:00.000Z',
  lastSeenAt: '2026-11-05T10:00:00.000Z',
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
})
