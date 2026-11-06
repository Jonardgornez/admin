import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_STATUS } from './api'
import {
  acceptRegistrationRequest,
  denyRegistrationRequest,
  listRegistrationRequests,
} from './registration-requests-api'

const request = {
  id: 9,
  name: 'LAB-PC12',
  ipAddress: '192.168.1.42',
  pairingNumber: '482915',
  requestedAt: '2026-11-06T09:00:00.000Z',
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('registration requests api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('listRegistrationRequests', () => {
    it('returns the waiting requests and marks the call as background', async () => {
      const fetchMock = stubFetch(Response.json({ requests: [request] }))
      expect(await listRegistrationRequests({ isBackground: true })).toEqual({
        success: true,
        data: [request],
      })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/registration-requests',
        expect.objectContaining({ method: 'GET', headers: { 'X-Background-Refresh': '1' } }),
      )
    })

    it('returns an empty list', async () => {
      stubFetch(Response.json({ requests: [] }))
      expect(await listRegistrationRequests({ isBackground: true })).toEqual({
        success: true,
        data: [],
      })
    })

    it('accepts a null IP address', async () => {
      stubFetch(Response.json({ requests: [{ ...request, ipAddress: null }] }))
      expect(await listRegistrationRequests({ isBackground: true })).toEqual({
        success: true,
        data: [{ ...request, ipAddress: null }],
      })
    })

    it.each([
      ['a pairing number with five digits', { pairingNumber: '48291' }],
      ['a pairing number with letters', { pairingNumber: '48291A' }],
      ['a missing name', { name: undefined }],
    ])('fails on an entry with %s', async (_label, override) => {
      stubFetch(Response.json({ requests: [{ ...request, ...override }] }))
      expect(await listRegistrationRequests({ isBackground: true })).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('fails when the requests field is missing', async () => {
      stubFetch(Response.json([request]))
      expect(await listRegistrationRequests({ isBackground: true })).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('drops fields beyond the contract', async () => {
      stubFetch(Response.json({ requests: [{ ...request, secret: 'internal' }] }))
      const result = await listRegistrationRequests({ isBackground: true })
      expect(result).toEqual({ success: true, data: [request] })
      expect(JSON.stringify(result)).not.toContain('internal')
    })

    it('passes through a 401 with its status', async () => {
      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))
      expect(await listRegistrationRequests({ isBackground: true })).toEqual({
        success: false,
        status: 401,
        error: 'Sign in again.',
      })
    })

    it('reports a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await listRegistrationRequests({ isBackground: true })).toMatchObject({
        success: false,
        status: NETWORK_ERROR_STATUS,
      })
    })
  })

  describe('acceptRegistrationRequest', () => {
    it('posts an empty JSON body to the accept path and returns no data on 204', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await acceptRegistrationRequest(9)).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/registration-requests/9/accept',
        expect.objectContaining({
          method: 'POST',
          body: '{}',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    it('returns a 404 with the server message', async () => {
      stubFetch(Response.json({ error: 'Request not found.' }, { status: 404 }))
      expect(await acceptRegistrationRequest(9)).toEqual({
        success: false,
        status: 404,
        error: 'Request not found.',
      })
    })

    it('returns a 409 with the name-taken message', async () => {
      stubFetch(Response.json({ error: 'Name already in use.' }, { status: 409 }))
      expect(await acceptRegistrationRequest(9)).toEqual({
        success: false,
        status: 409,
        error: 'Name already in use.',
      })
    })
  })

  describe('denyRegistrationRequest', () => {
    it('posts an empty JSON body to the deny path and returns no data on 204', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await denyRegistrationRequest(9)).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/registration-requests/9/deny',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      )
    })

    it('returns a 404 failure', async () => {
      stubFetch(Response.json({ error: 'Request not found.' }, { status: 404 }))
      expect(await denyRegistrationRequest(9)).toMatchObject({ success: false, status: 404 })
    })
  })
})
