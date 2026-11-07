import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE, NETWORK_ERROR_STATUS } from './api'
import { sendPcMessage } from './messages-api'

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const delivery = { pcId: 1, pcName: 'PC-1', status: 'delivered' }

describe('messages api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('sendPcMessage', () => {
    it('posts the PC ids and text', async () => {
      const fetchMock = stubFetch(Response.json({ results: [delivery] }))
      await sendPcMessage([1, 3], 'Please save your work.')
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pcs/messages',
        expect.objectContaining({
          method: 'POST',
          credentials: 'same-origin',
          body: JSON.stringify({ pcIds: [1, 3], text: 'Please save your work.' }),
        }),
      )
    })

    it('returns the delivery results', async () => {
      const results = [
        delivery,
        { pcId: 3, pcName: 'PC-4', status: 'offline' },
        { pcId: 5, pcName: 'PC-6', status: 'failed' },
      ]
      stubFetch(Response.json({ results }))
      expect(await sendPcMessage([1, 3, 5], 'Hi')).toEqual({ success: true, data: results })
    })

    it('accepts every status the server can report', async () => {
      const statuses = ['delivered', 'failed', 'offline', 'not-found', 'busy']
      const results = statuses.map((status, index) => ({
        pcId: index + 1,
        pcName: `PC-${index + 1}`,
        status,
      }))
      stubFetch(Response.json({ results }))
      expect(await sendPcMessage([1, 2, 3, 4, 5], 'Hi')).toEqual({ success: true, data: results })
    })

    it('drops fields the server sends beyond the contract', async () => {
      stubFetch(Response.json({ results: [{ ...delivery, token: 'secret' }] }))
      expect(await sendPcMessage([1], 'Hi')).toEqual({ success: true, data: [delivery] })
    })

    it('returns the server error message on a 400', async () => {
      stubFetch(Response.json({ error: 'Message is too long.' }, { status: 400 }))
      expect(await sendPcMessage([1], 'x')).toEqual({
        success: false,
        status: 400,
        error: 'Message is too long.',
      })
    })

    it('returns the status on a 401', async () => {
      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))
      expect(await sendPcMessage([1], 'Hi')).toEqual({
        success: false,
        status: 401,
        error: 'Sign in again.',
      })
    })

    it('reports a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await sendPcMessage([1], 'Hi')).toEqual({
        success: false,
        status: NETWORK_ERROR_STATUS,
        error: NETWORK_ERROR_MESSAGE,
      })
    })

    it('reports a fallback error when the body is not JSON', async () => {
      stubFetch(new Response('<html>oops</html>', { status: 200 }))
      expect(await sendPcMessage([1], 'Hi')).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('fails when the results are missing', async () => {
      stubFetch(Response.json({ delivered: 1 }))
      expect(await sendPcMessage([1], 'Hi')).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('fails on an unknown status', async () => {
      stubFetch(Response.json({ results: [{ ...delivery, status: 'read' }] }))
      expect(await sendPcMessage([1], 'Hi')).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })
  })
})
