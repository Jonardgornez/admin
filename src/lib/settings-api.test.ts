import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from './api'
import { getSettings, saveSettings, type AppSettings } from './settings-api'

const settings: AppSettings = {
  defaultApproval: { mode: 'time-limit', minutes: 60 },
  notice: { isEnabled: true, text: 'Monitored.' },
  idleTimeoutMinutes: 30,
  defaultViewMode: 'notified',
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('settings api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getSettings', () => {
    it('returns the saved settings', async () => {
      const fetchMock = stubFetch(Response.json(settings))
      expect(await getSettings()).toEqual({ success: true, data: settings })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('accepts open time and anonymous view', async () => {
      const open = {
        ...settings,
        defaultApproval: { mode: 'open-time', minutes: 60 },
        defaultViewMode: 'anonymous',
      }
      stubFetch(Response.json(open))
      expect(await getSettings()).toEqual({ success: true, data: open })
    })

    it('strips fields the schema does not name', async () => {
      stubFetch(Response.json({ ...settings, secret: 'internal' }))
      const result = await getSettings()
      expect(result).toEqual({ success: true, data: settings })
      expect(JSON.stringify(result)).not.toContain('internal')
    })

    it('fails on an unknown view mode', async () => {
      stubFetch(Response.json({ ...settings, defaultViewMode: 'hidden' }))
      expect(await getSettings()).toEqual({
        success: false,
        status: 200,
        error: FALLBACK_ERROR_MESSAGE,
      })
    })

    it('fails when a section is missing', async () => {
      stubFetch(Response.json({ ...settings, notice: undefined }))
      expect(await getSettings()).toMatchObject({ success: false, error: FALLBACK_ERROR_MESSAGE })
    })

    it('passes through a 401 with its status', async () => {
      stubFetch(Response.json({ error: 'Sign in again.' }, { status: 401 }))
      expect(await getSettings()).toEqual({ success: false, status: 401, error: 'Sign in again.' })
    })
  })

  describe('saveSettings', () => {
    it('puts the settings as JSON and returns the saved copy', async () => {
      const fetchMock = stubFetch(Response.json(settings))
      expect(await saveSettings(settings)).toEqual({ success: true, data: settings })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(settings),
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    it('returns the server message on a 400', async () => {
      stubFetch(Response.json({ error: 'Notice text is required.' }, { status: 400 }))
      expect(await saveSettings(settings)).toEqual({
        success: false,
        status: 400,
        error: 'Notice text is required.',
      })
    })
  })
})
