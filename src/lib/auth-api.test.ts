import { afterEach, describe, expect, it, vi } from 'vitest'
import { changePassword, getCurrentAdmin, signIn, signOut } from './auth-api'

function stubFetch(response: Response) {
  const fetchMock = vi.fn(() => Promise.resolve(response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('auth api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('signIn posts the credentials and returns the username', async () => {
    const fetchMock = stubFetch(Response.json({ username: 'admin' }))
    const result = await signIn('admin', 'secret')
    expect(result).toEqual({ success: true, data: { username: 'admin' } })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'admin', password: 'secret' }),
      }),
    )
  })

  it('signIn reports wrong credentials', async () => {
    stubFetch(Response.json({ error: 'Wrong username or password.' }, { status: 401 }))
    expect(await signIn('admin', 'nope')).toMatchObject({ success: false, status: 401 })
  })

  it('signOut posts to logout', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    expect(await signOut()).toEqual({ success: true, data: undefined })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('getCurrentAdmin returns the session', async () => {
    const fetchMock = stubFetch(Response.json({ username: 'admin' }))
    expect(await getCurrentAdmin()).toEqual({ success: true, data: { username: 'admin' } })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('getCurrentAdmin reports a 401', async () => {
    stubFetch(new Response(null, { status: 401 }))
    expect(await getCurrentAdmin()).toMatchObject({ success: false, status: 401 })
  })

  it('changePassword posts both passwords', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    expect(await changePassword('old-pass', 'new-password')).toEqual({
      success: true,
      data: undefined,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/change-password',
      expect.objectContaining({
        body: JSON.stringify({ currentPassword: 'old-pass', newPassword: 'new-password' }),
      }),
    )
  })

  it('changePassword returns the server error', async () => {
    stubFetch(Response.json({ error: 'Current password is wrong.' }, { status: 400 }))
    expect(await changePassword('x', 'new-password')).toEqual({
      success: false,
      status: 400,
      error: 'Current password is wrong.',
    })
  })
})
