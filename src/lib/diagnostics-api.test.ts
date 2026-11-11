import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE } from './api'
import { getPcDiagnostics, NO_REPORT_MESSAGE } from './diagnostics-api'

const report = {
  receivedAt: '2026-11-05T10:02:00.000Z',
  serviceVersion: '0.23.0',
  clientRunning: false,
  clientVersion: '0.22.0',
  userSignedIn: true,
  update: { version: '0.23.0', state: 'failed', error: 'Disk full' },
  events: [{ at: '2026-11-05T10:01:00.000Z', level: 'error', message: 'Client exited' }],
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('getPcDiagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the latest report of the PC', async () => {
    const fetchMock = stubFetch(Response.json(report))

    expect(await getPcDiagnostics(7)).toEqual({ success: true, data: report })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pcs/7/diagnostics',
      expect.objectContaining({ method: 'GET', headers: undefined }),
    )
  })

  it('reads a report with no update and no events', async () => {
    stubFetch(Response.json({ ...report, clientVersion: null, update: null, events: [] }))

    expect(await getPcDiagnostics(7)).toEqual({
      success: true,
      data: { ...report, clientVersion: null, update: null, events: [] },
    })
  })

  it('marks background polls with the refresh header', async () => {
    const fetchMock = stubFetch(Response.json(report))

    await getPcDiagnostics(7, { isBackground: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pcs/7/diagnostics',
      expect.objectContaining({ headers: { 'X-Background-Refresh': '1' } }),
    )
  })

  it('returns the no-report message from a 404', async () => {
    stubFetch(Response.json({ error: NO_REPORT_MESSAGE }, { status: 404 }))

    expect(await getPcDiagnostics(7)).toEqual({
      success: false,
      status: 404,
      error: 'No report from this PC yet.',
    })
  })

  it('returns the PC-not-found message from a 404', async () => {
    stubFetch(Response.json({ error: 'PC not found.' }, { status: 404 }))

    expect(await getPcDiagnostics(7)).toEqual({
      success: false,
      status: 404,
      error: 'PC not found.',
    })
  })

  it('reports a fallback error when a 200 body does not match the report shape', async () => {
    stubFetch(Response.json({ ...report, serviceVersion: 'latest' }))

    expect(await getPcDiagnostics(7)).toEqual({
      success: false,
      status: 200,
      error: FALLBACK_ERROR_MESSAGE,
    })
  })

  it('rejects an update state the admin does not know', async () => {
    stubFetch(Response.json({ ...report, update: { ...report.update, state: 'unknown' } }))

    expect((await getPcDiagnostics(7)).success).toBe(false)
  })

  it('rejects an event level the admin does not know', async () => {
    stubFetch(
      Response.json({ ...report, events: [{ at: report.receivedAt, level: 'debug', message: 'x' }] }),
    )

    expect((await getPcDiagnostics(7)).success).toBe(false)
  })

  it('reports a network error when the server cannot be reached', async () => {
    stubFetch(new TypeError('Failed to fetch'))

    expect(await getPcDiagnostics(7)).toEqual({
      success: false,
      status: 0,
      error: "Can't reach the server. Check that it's running.",
    })
  })
})
