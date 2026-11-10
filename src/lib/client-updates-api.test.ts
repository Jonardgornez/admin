import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from './api'
import {
  getClientRelease,
  removeClientRelease,
  uploadClientRelease,
} from './client-updates-api'

const release = {
  version: '0.20.0',
  sha256: 'a'.repeat(64),
  sizeBytes: 78643200,
  uploadedAtUtc: '2026-11-10T09:30:00.000Z',
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function installer(name = 'LykantraSetup.exe') {
  return new File(['MZ'], name, { type: 'application/x-msdownload' })
}

describe('client updates api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getClientRelease', () => {
    it('returns the stored release', async () => {
      stubFetch(Response.json({ release }))
      expect(await getClientRelease()).toEqual({ success: true, data: release })
    })

    it('returns null when no installer is uploaded', async () => {
      stubFetch(Response.json({ release: null }))
      expect(await getClientRelease()).toEqual({ success: true, data: null })
    })

    it('drops fields the schema does not name', async () => {
      stubFetch(Response.json({ release: { ...release, storagePath: 'C:/secret' } }))
      expect(JSON.stringify(await getClientRelease())).not.toContain('storagePath')
    })

    it.each([
      ['a version that is not major.minor.patch', { ...release, version: '0.20' }],
      ['a hash that is not 64 lowercase hex characters', { ...release, sha256: 'ABC' }],
      ['a negative size', { ...release, sizeBytes: -1 }],
      ['a date that cannot be read', { ...release, uploadedAtUtc: 'yesterday' }],
    ])('fails for %s', async (_case, badRelease) => {
      stubFetch(Response.json({ release: badRelease }))
      expect(await getClientRelease()).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('returns the server error when the request fails', async () => {
      stubFetch(Response.json({ error: 'Server is busy.' }, { status: 500 }))
      expect(await getClientRelease()).toEqual({
        success: false,
        status: 500,
        error: 'Server is busy.',
      })
    })
  })

  describe('uploadClientRelease', () => {
    it('sends the installer bytes as a PUT with the octet-stream type', async () => {
      const fetchMock = stubFetch(Response.json(release))
      const file = installer()

      expect(await uploadClientRelease(file)).toEqual({ success: true, data: release })
      expect(fetchMock).toHaveBeenCalledWith('/api/client-updates', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      })
    })

    it('does not call the server for a file that is not an .exe', async () => {
      const fetchMock = stubFetch(Response.json(release))
      expect(await uploadClientRelease(installer('setup.zip'))).toEqual({
        success: false,
        status: 400,
        error: 'Choose LykantraSetup.exe.',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns the server message for a rejected installer', async () => {
      stubFetch(
        Response.json(
          { error: 'This installer is version 0.19.0. Upload a version newer than 0.20.0.' },
          { status: 400 },
        ),
      )
      expect(await uploadClientRelease(installer())).toEqual({
        success: false,
        status: 400,
        error: 'This installer is version 0.19.0. Upload a version newer than 0.20.0.',
      })
    })

    it('returns the server message when the installer is too large', async () => {
      stubFetch(
        Response.json({ error: 'The installer must be 150 MB or smaller.' }, { status: 413 }),
      )
      expect(await uploadClientRelease(installer())).toEqual({
        success: false,
        status: 413,
        error: 'The installer must be 150 MB or smaller.',
      })
    })

    it('fails with a friendly error when the reply does not match', async () => {
      stubFetch(Response.json({ version: 'nope' }))
      expect(await uploadClientRelease(installer())).toMatchObject({
        success: false,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })
  })

  describe('removeClientRelease', () => {
    it('sends a DELETE and succeeds on 204', async () => {
      const fetchMock = stubFetch(new Response(null, { status: 204 }))
      expect(await removeClientRelease()).toEqual({ success: true, data: undefined })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/client-updates',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })

    it('returns the server error when removal fails', async () => {
      stubFetch(Response.json({ error: 'Could not remove the installer.' }, { status: 500 }))
      expect(await removeClientRelease()).toEqual({
        success: false,
        status: 500,
        error: 'Could not remove the installer.',
      })
    })
  })
})
