import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_STATUS } from './api'
import { getServerInfo } from './server-info-api'

const serverInfo = {
  primaryAddress: '192.168.1.10',
  otherAddresses: ['10.0.0.5'],
  clientPort: 5050,
  adminPort: 5051,
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('server info api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getServerInfo', () => {
    it('returns the addresses and ports', async () => {
      const fetchMock = stubFetch(Response.json(serverInfo))
      expect(await getServerInfo()).toEqual({ success: true, data: serverInfo })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/server-info',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('accepts no primary address and no other addresses', async () => {
      const noNetwork = { ...serverInfo, primaryAddress: null, otherAddresses: [] }
      stubFetch(Response.json(noNetwork))
      expect(await getServerInfo()).toEqual({ success: true, data: noNetwork })
    })

    it('drops fields beyond the contract', async () => {
      stubFetch(Response.json({ ...serverInfo, hostname: 'internal' }))
      const result = await getServerInfo()
      expect(result).toEqual({ success: true, data: serverInfo })
      expect(JSON.stringify(result)).not.toContain('internal')
    })

    it('fails when a port is not a number', async () => {
      stubFetch(Response.json({ ...serverInfo, clientPort: '5050' }))
      expect(await getServerInfo()).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('reports a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await getServerInfo()).toMatchObject({
        success: false,
        status: NETWORK_ERROR_STATUS,
      })
    })
  })
})
