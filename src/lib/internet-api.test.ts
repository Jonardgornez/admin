import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE, NETWORK_ERROR_STATUS } from './api'
import { setPcsInternetBlocked } from './internet-api'

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const okResult = { pcId: 1, pcName: 'PC-1', result: 'ok' }

describe('internet api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('setPcsInternetBlocked', () => {
    it('posts the PC ids and the blocked flag to the internet route', async () => {
      const fetchMock = stubFetch(Response.json({ results: [okResult] }))
      await setPcsInternetBlocked([1, 3], true)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/internet',
        expect.objectContaining({
          method: 'POST',
          credentials: 'same-origin',
          body: JSON.stringify({ pcIds: [1, 3], blocked: true }),
        }),
      )
    })

    it('posts blocked false to turn the internet back on', async () => {
      const fetchMock = stubFetch(Response.json({ results: [okResult] }))
      await setPcsInternetBlocked([1], false)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/internet',
        expect.objectContaining({ body: JSON.stringify({ pcIds: [1], blocked: false }) }),
      )
    })

    it('returns the result of each PC', async () => {
      const results = [
        okResult,
        { pcId: 2, pcName: 'SRV', result: 'server-pc' },
        { pcId: 5, pcName: 'PC-6', result: 'not-found' },
      ]
      stubFetch(Response.json({ results }))
      expect(await setPcsInternetBlocked([1, 2, 5], true)).toEqual({ success: true, data: results })
    })

    it('names a removed PC by its id when the server has no name for it', async () => {
      stubFetch(Response.json({ results: [{ pcId: 7, pcName: null, result: 'not-found' }] }))
      expect(await setPcsInternetBlocked([7], true)).toEqual({
        success: true,
        data: [{ pcId: 7, pcName: 'PC #7', result: 'not-found' }],
      })
    })

    it('drops fields the server sends beyond the contract', async () => {
      stubFetch(Response.json({ results: [{ ...okResult, token: 'secret' }] }))
      expect(await setPcsInternetBlocked([1], true)).toEqual({ success: true, data: [okResult] })
    })

    it('fails on an unknown result', async () => {
      stubFetch(Response.json({ results: [{ ...okResult, result: 'blocked' }] }))
      expect(await setPcsInternetBlocked([1], true)).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('fails when the results are missing', async () => {
      stubFetch(Response.json({ affected: 1 }))
      expect(await setPcsInternetBlocked([1], true)).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('returns the server message on a 400', async () => {
      stubFetch(Response.json({ error: 'Choose at least one PC.' }, { status: 400 }))
      expect(await setPcsInternetBlocked([], true)).toEqual({
        success: false,
        status: 400,
        error: 'Choose at least one PC.',
      })
    })

    it('returns the status on a 401', async () => {
      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))
      expect(await setPcsInternetBlocked([1], true)).toEqual({
        success: false,
        status: 401,
        error: 'Sign in again.',
      })
    })

    it('returns the fallback message on a 500 without a message', async () => {
      stubFetch(new Response('<html>oops</html>', { status: 500 }))
      expect(await setPcsInternetBlocked([1], true)).toEqual({
        success: false,
        status: 500,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('reports a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await setPcsInternetBlocked([1], true)).toEqual({
        success: false,
        status: NETWORK_ERROR_STATUS,
        error: NETWORK_ERROR_MESSAGE,
      })
    })
  })
})
