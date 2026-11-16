import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_STATUS } from './api'
import {
  clearUninstallPassword,
  getUninstallPasswordStatus,
  setUninstallPassword,
} from './uninstall-password-api'

const PATH = '/api/settings/uninstall-password'

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentBody(fetchMock: ReturnType<typeof stubFetch>): unknown {
  return JSON.parse(String(fetchMock.mock.calls[0][1].body))
}

describe('uninstall password api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getUninstallPasswordStatus', () => {
    it('returns whether a password is set', async () => {
      const fetchMock = stubFetch(Response.json({ isSet: true }))
      expect(await getUninstallPasswordStatus()).toEqual({ success: true, data: { isSet: true } })
      expect(fetchMock).toHaveBeenCalledWith(PATH, expect.objectContaining({ method: 'GET' }))
    })

    it('drops fields beyond the contract', async () => {
      stubFetch(Response.json({ isSet: false, hash: 'secret-hash' }))
      const result = await getUninstallPasswordStatus()
      expect(result).toEqual({ success: true, data: { isSet: false } })
      expect(JSON.stringify(result)).not.toContain('secret-hash')
    })

    it('fails when isSet is not a boolean', async () => {
      stubFetch(Response.json({ isSet: 'yes' }))
      expect(await getUninstallPasswordStatus()).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('reports a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await getUninstallPasswordStatus()).toMatchObject({
        success: false,
        status: NETWORK_ERROR_STATUS,
      })
    })
  })

  describe('setUninstallPassword', () => {
    it('sends the password with PUT and returns the new status', async () => {
      const fetchMock = stubFetch(Response.json({ isSet: true }))
      expect(await setUninstallPassword('lab-secret-1')).toEqual({
        success: true,
        data: { isSet: true },
      })
      expect(fetchMock.mock.calls[0][0]).toBe(PATH)
      expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
      expect(sentBody(fetchMock)).toEqual({ password: 'lab-secret-1' })
    })

    it('returns the server error message on a 400', async () => {
      stubFetch(
        Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 }),
      )
      expect(await setUninstallPassword('short')).toEqual({
        success: false,
        status: 400,
        error: 'Password must be at least 8 characters.',
      })
    })
  })

  describe('clearUninstallPassword', () => {
    it('sends a null password with PUT and returns the new status', async () => {
      const fetchMock = stubFetch(Response.json({ isSet: false }))
      expect(await clearUninstallPassword()).toEqual({ success: true, data: { isSet: false } })
      expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
      expect(sentBody(fetchMock)).toEqual({ password: null })
    })

    it('reports a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await clearUninstallPassword()).toMatchObject({
        success: false,
        status: NETWORK_ERROR_STATUS,
      })
    })
  })
})
