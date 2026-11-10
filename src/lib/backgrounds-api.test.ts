import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from './api'
import {
  backgroundImageUrl,
  getBackgrounds,
  removeBackground,
  uploadBackground,
  type BackgroundInfo,
} from './backgrounds-api'
import type { BackgroundKind } from './backgrounds'

const info: BackgroundInfo = {
  contentType: 'image/png',
  sizeBytes: 1258291,
  sha256: 'a'.repeat(64),
  updatedAtUtc: '2026-11-10T09:30:00.000Z',
}

const UNKNOWN_KIND = '../accounts' as BackgroundKind

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('backgrounds api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getBackgrounds', () => {
    it('returns the info for each kind, or null when none is set', async () => {
      stubFetch(Response.json({ login: info, lock: null }))
      expect(await getBackgrounds()).toEqual({
        success: true,
        data: { login: info, lock: null },
      })
    })

    it('drops fields the schema does not name', async () => {
      stubFetch(Response.json({ login: { ...info, storagePath: 'C:/secret' }, lock: null }))
      const result = await getBackgrounds()
      expect(JSON.stringify(result)).not.toContain('storagePath')
    })

    it('fails with a friendly error when the body does not match', async () => {
      stubFetch(Response.json({ login: 'oops' }))
      expect(await getBackgrounds()).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it.each([
      ['a hash that is not 64 hex characters', { ...info, sha256: 'abc123' }],
      ['a negative size', { ...info, sizeBytes: -1 }],
      ['a date that cannot be read', { ...info, updatedAtUtc: 'yesterday' }],
    ])('fails for %s', async (_case, badInfo) => {
      stubFetch(Response.json({ login: badInfo, lock: null }))
      expect(await getBackgrounds()).toMatchObject({ success: false })
    })
  })

  describe('uploadBackground', () => {
    it('sends the file bytes as a PUT with the file image type', async () => {
      const fetchMock = stubFetch(Response.json(info))
      const file = new File(['png'], 'login.png', { type: 'image/png' })

      expect(await uploadBackground('login', file)).toEqual({ success: true, data: info })
      expect(fetchMock).toHaveBeenCalledWith('/api/backgrounds/login', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'image/png' },
        body: file,
      })
    })

    it('does not call the server for a file that is not PNG or JPEG', async () => {
      const fetchMock = stubFetch(Response.json(info))
      const file = new File(['gif'], 'anim.gif', { type: 'image/gif' })

      expect(await uploadBackground('lock', file)).toEqual({
        success: false,
        status: 400,
        error: 'Choose a PNG or JPEG image.',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns the server error message', async () => {
      stubFetch(Response.json({ error: 'The image must be 5 MB or smaller.' }, { status: 413 }))
      const file = new File(['x'], 'big.jpg', { type: 'image/jpeg' })

      expect(await uploadBackground('login', file)).toEqual({
        success: false,
        status: 413,
        error: 'The image must be 5 MB or smaller.',
      })
    })
  })

  describe('removeBackground', () => {
    it('sends a DELETE for the kind', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await removeBackground('lock')).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/backgrounds/lock',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('refuses a kind that is not login or lock before calling the server', () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(() => removeBackground(UNKNOWN_KIND)).toThrow()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('backgroundImageUrl', () => {
    it('adds the hash as a cache-busting query', () => {
      expect(backgroundImageUrl('login', 'abc123')).toBe('/api/backgrounds/login/image?v=abc123')
    })

    it('encodes the hash so it cannot change the path', () => {
      expect(backgroundImageUrl('lock', 'a/b?c')).toBe(
        '/api/backgrounds/lock/image?v=a%2Fb%3Fc',
      )
    })

    it('refuses a kind that is not login or lock', () => {
      expect(() => backgroundImageUrl(UNKNOWN_KIND, 'abc')).toThrow()
    })
  })
})
