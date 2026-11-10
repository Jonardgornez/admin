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

  it('sends the background refresh header only when asked', async () => {
    const fetchMock = stubFetch(Response.json([]))
    await apiRequest('/api/x', { isBackground: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({ headers: { 'X-Background-Refresh': '1' } }),
    )
  })

  it('keeps the JSON content type next to the background header', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    await apiRequest('/api/x', { method: 'POST', body: {}, isBackground: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', 'X-Background-Refresh': '1' },
      }),
    )
  })

  it('does not send the background header on normal requests', async () => {
    const fetchMock = stubFetch(Response.json([]))
    await apiRequest('/api/x')
    await apiRequest('/api/x', { isBackground: false })
    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(init.headers).toBeUndefined()
    }
  })

  it('sends a raw blob as-is with its own content type and no JSON encoding', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    const blob = new Blob(['png-bytes'], { type: 'image/png' })
    await apiRequest('/api/backgrounds/login', {
      method: 'PUT',
      rawBody: { blob, contentType: 'image/png' },
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/backgrounds/login', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'image/png' },
      body: blob,
    })
  })

  it('keeps the background header next to a raw body', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    await apiRequest('/api/x', {
      method: 'PUT',
      rawBody: { blob: new Blob(['x']), contentType: 'image/jpeg' },
      isBackground: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({
        headers: { 'Content-Type': 'image/jpeg', 'X-Background-Refresh': '1' },
      }),
    )
  })

  it('returns the server error for a rejected raw upload', async () => {
    stubFetch(Response.json({ error: 'The image must be 5 MB or smaller.' }, { status: 413 }))
    expect(
      await apiRequest('/api/backgrounds/lock', {
        method: 'PUT',
        rawBody: { blob: new Blob(['x']), contentType: 'image/png' },
      }),
    ).toEqual({ success: false, status: 413, error: 'The image must be 5 MB or smaller.' })
  })

  it.each(['PUT', 'PATCH', 'DELETE'] as const)('sends the %s method', async (method) => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    await apiRequest('/api/x/1', { method })
    expect(fetchMock).toHaveBeenCalledWith('/api/x/1', expect.objectContaining({ method }))
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
