import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_STATUS } from './api'
import { getSetupCode, regenerateSetupCode } from './setup-code-api'

const validCode = 'ABCD-EFGH-IJKL-MNOP-QRST-U234'

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const malformedCodes = [
  ['lowercase letters', 'abcd-efgh-ijkl-mnop-qrst-u234'],
  ['the digits 0 and 1', 'ABCD-EFGH-IJKL-MNOP-QRST-U201'],
  ['five groups', 'ABCD-EFGH-IJKL-MNOP-QRST'],
  ['seven groups', 'ABCD-EFGH-IJKL-MNOP-QRST-U234-ABCD'],
  ['a short group', 'ABC-EFGH-IJKL-MNOP-QRST-U234'],
  ['no dashes', 'ABCDEFGHIJKLMNOPQRSTU234'],
  ['trailing text', `${validCode}\n`],
  ['an empty string', ''],
]

describe('setup code api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getSetupCode', () => {
    it('gets the current code', async () => {
      const fetchMock = stubFetch(Response.json({ code: validCode }))
      expect(await getSetupCode()).toEqual({ success: true, data: { code: validCode } })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/setup-code',
        expect.objectContaining({ method: 'GET', body: undefined }),
      )
    })

    it('drops fields beyond the contract', async () => {
      stubFetch(Response.json({ code: validCode, secret: 'x' }))
      expect(await getSetupCode()).toEqual({ success: true, data: { code: validCode } })
    })

    it.each(malformedCodes)('fails on a code with %s', async (_label, code) => {
      stubFetch(Response.json({ code }))
      expect(await getSetupCode()).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it.each([
      ['a missing code', {}],
      ['a non-text code', { code: 5 }],
      ['a bare string', validCode],
    ])('fails on %s', async (_label, body) => {
      stubFetch(Response.json(body))
      expect(await getSetupCode()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })
    })

    it('returns the status and message of a 401', async () => {
      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))
      expect(await getSetupCode()).toEqual({ success: false, status: 401, error: 'Sign in again.' })
    })

    it('reports a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await getSetupCode()).toMatchObject({ success: false, status: NETWORK_ERROR_STATUS })
    })
  })

  describe('regenerateSetupCode', () => {
    it('posts an empty JSON body and returns the new code', async () => {
      const fetchMock = stubFetch(Response.json({ code: validCode }))
      expect(await regenerateSetupCode()).toEqual({ success: true, data: { code: validCode } })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/setup-code/regenerate',
        expect.objectContaining({
          method: 'POST',
          body: '{}',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    it.each(malformedCodes)('fails on a code with %s', async (_label, code) => {
      stubFetch(Response.json({ code }))
      expect(await regenerateSetupCode()).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('returns the status and message of a 401', async () => {
      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))
      expect(await regenerateSetupCode()).toEqual({
        success: false,
        status: 401,
        error: 'Sign in again.',
      })
    })

    it('returns the server message on a failure', async () => {
      stubFetch(Response.json({ error: 'Try later.' }, { status: 500 }))
      expect(await regenerateSetupCode()).toEqual({
        success: false,
        status: 500,
        error: 'Try later.',
      })
    })
  })
})
