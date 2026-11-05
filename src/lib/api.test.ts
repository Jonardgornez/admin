import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from './api'

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed data on success', async () => {
    stubFetch(Response.json({ username: 'admin' }))
    expect(await apiRequest('/api/auth/me')).toEqual({ success: true, data: { username: 'admin' } })
  })

  it('sends same-origin credentials and a JSON body', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    await apiRequest('/api/x', { method: 'POST', body: { a: 1 } })
    expect(fetchMock).toHaveBeenCalledWith('/api/x', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    })
  })

  it('handles an empty 204 body', async () => {
    stubFetch(new Response(null, { status: 204 }))
    expect(await apiRequest('/api/auth/logout', { method: 'POST' })).toEqual({
      success: true,
      data: undefined,
    })
  })

  it('returns the server error message and status', async () => {
    stubFetch(Response.json({ error: 'Wrong username or password.' }, { status: 401 }))
    expect(await apiRequest('/api/auth/login', { method: 'POST' })).toEqual({
      success: false,
      status: 401,
      error: 'Wrong username or password.',
    })
  })

  it('falls back when the error body has no error field', async () => {
    stubFetch(Response.json({ title: 'Bad Request', status: 400 }, { status: 400 }))
    expect(await apiRequest('/api/x')).toEqual({
      success: false,
      status: 400,
      error: FALLBACK_ERROR_MESSAGE,
    })
  })

  it('falls back when the error field is not a string', async () => {
    stubFetch(Response.json({ error: { nested: true } }, { status: 400 }))
    expect(await apiRequest('/api/x')).toMatchObject({ error: FALLBACK_ERROR_MESSAGE })
  })

  it('falls back when the error body is not JSON', async () => {
    stubFetch(new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await apiRequest('/api/x')).toEqual({
      success: false,
      status: 502,
      error: FALLBACK_ERROR_MESSAGE,
    })
  })

  it('fails with a friendly error when a success body is not JSON', async () => {
    stubFetch(new Response('ok', { status: 200 }))
    expect(await apiRequest('/api/x')).toMatchObject({
      success: false,
      error: FALLBACK_ERROR_MESSAGE,
    })
  })

  it('returns a friendly error on network failure', async () => {
    stubFetch(new TypeError('Failed to fetch'))
    expect(await apiRequest('/api/x')).toEqual({
      success: false,
      status: 0,
      error: NETWORK_ERROR_MESSAGE,
    })
  })
})
