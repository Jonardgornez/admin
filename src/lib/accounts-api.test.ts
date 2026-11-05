import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from './api'
import {
  createAccount,
  deleteAccount,
  listAccounts,
  setAccountActive,
  updateAccount,
} from './accounts-api'

const account = {
  id: 7,
  username: 'lab-pc01',
  isActive: true,
  defaultTime: { mode: 'time-limit', minutes: 60 },
  lastLoginAt: null,
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('accounts api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('listAccounts', () => {
    it('returns the accounts', async () => {
      const fetchMock = stubFetch(Response.json([account]))
      expect(await listAccounts()).toEqual({ success: true, data: [account] })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/accounts',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('fails with the fallback message when the body is not an account list', async () => {
      stubFetch(Response.json({ accounts: [] }))
      expect(await listAccounts()).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('fails when an account has the wrong field types', async () => {
      stubFetch(Response.json([{ ...account, isActive: 'yes' }]))
      expect(await listAccounts()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })
    })

    it('fails when the default time mode is unknown', async () => {
      stubFetch(Response.json([{ ...account, defaultTime: { mode: 'forever' } }]))
      expect(await listAccounts()).toMatchObject({ success: false })
    })

    it('strips fields the schema does not name, such as a password hash', async () => {
      stubFetch(Response.json([{ ...account, passwordHash: 'secret-hash' }]))
      const result = await listAccounts()
      expect(result).toEqual({ success: true, data: [account] })
      expect(JSON.stringify(result)).not.toContain('secret-hash')
    })

    it('passes through a server error with its status', async () => {
      stubFetch(Response.json({ error: 'Session expired.' }, { status: 401 }))
      expect(await listAccounts()).toEqual({
        success: false,
        status: 401,
        error: 'Session expired.',
      })
    })
  })

  describe('createAccount', () => {
    const payload = {
      username: 'lab-pc01',
      password: 'longenough',
      defaultTime: { mode: 'open-time' },
    } as const

    it('posts the payload and returns the created account', async () => {
      const fetchMock = stubFetch(Response.json(account, { status: 201 }))
      expect(await createAccount(payload)).toEqual({ success: true, data: account })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/accounts',
        expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
      )
    })

    it('strips extra fields from the response', async () => {
      stubFetch(Response.json({ ...account, passwordHash: 'secret-hash' }, { status: 201 }))
      const result = await createAccount(payload)
      expect(result).toEqual({ success: true, data: account })
      expect(JSON.stringify(result)).not.toContain('secret-hash')
    })

    it('reports a malformed body with the 201 status', async () => {
      stubFetch(Response.json({ id: 'x' }, { status: 201 }))
      expect(await createAccount(payload)).toEqual({
        success: false,
        status: 201,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('returns the 409 message when the username is taken', async () => {
      stubFetch(Response.json({ error: 'That username is already taken.' }, { status: 409 }))
      expect(await createAccount(payload)).toEqual({
        success: false,
        status: 409,
        error: 'That username is already taken.',
      })
    })
  })

  describe('updateAccount', () => {
    it('puts to the account URL and sends no password when none is given', async () => {
      const fetchMock = stubFetch(Response.json(account))
      const payload = { username: 'lab-pc01', defaultTime: { mode: 'open-time' } } as const
      expect(await updateAccount(7, payload)).toEqual({ success: true, data: account })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/accounts/7',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify(payload) }),
      )
    })

    it('returns a 404 failure', async () => {
      stubFetch(Response.json({ error: 'Account not found.' }, { status: 404 }))
      expect(
        await updateAccount(7, { username: 'a', defaultTime: { mode: 'open-time' } }),
      ).toMatchObject({ success: false, status: 404, error: 'Account not found.' })
    })
  })

  describe('setAccountActive', () => {
    it('patches the status endpoint', async () => {
      const fetchMock = stubFetch(Response.json({ ...account, isActive: false }))
      expect(await setAccountActive(7, false)).toEqual({
        success: true,
        data: { ...account, isActive: false },
      })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/accounts/7/status',
        expect.objectContaining({ method: 'PATCH', body: '{"isActive":false}' }),
      )
    })

    it('fails on a malformed body', async () => {
      stubFetch(Response.json([]))
      expect(await setAccountActive(7, true)).toMatchObject({ success: false })
    })
  })

  describe('deleteAccount', () => {
    it('sends DELETE and accepts 204', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await deleteAccount(7)).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/accounts/7',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('returns a 404 failure', async () => {
      stubFetch(Response.json({ error: 'Account not found.' }, { status: 404 }))
      expect(await deleteAccount(7)).toMatchObject({ success: false, status: 404 })
    })

    it('returns a network failure', async () => {
      stubFetch(new TypeError('Failed to fetch'))
      expect(await deleteAccount(7)).toMatchObject({ success: false, status: 0 })
    })
  })
})
