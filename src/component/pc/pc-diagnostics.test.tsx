// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIAGNOSTICS_EMPTY_TEXT } from '../../lib/diagnostics'
import { NO_REPORT_MESSAGE } from '../../lib/diagnostics-api'
import { TestProviders } from '../../test/test-providers'
import type { PcDiagnostics } from '../../types'
import { DIAGNOSTICS_POLL_INTERVAL_MS } from './use-pc-diagnostics'
import { PcDiagnostics as PcDiagnosticsSection } from './pc-diagnostics'

const MINUTE_MS = 60_000

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE_MS).toISOString()
}

function diagnosticsReport(overrides: Partial<PcDiagnostics> = {}): PcDiagnostics {
  return {
    receivedAt: minutesAgo(1),
    serviceVersion: '0.23.0',
    clientRunning: false,
    clientVersion: '0.22.0',
    userSignedIn: true,
    update: null,
    events: [],
    ...overrides,
  }
}

// Each call takes the next responder, and the last one repeats.
function stubDiagnostics(...responders: Array<() => Response | Promise<Response>>) {
  let callCount = 0
  const fetchMock = vi.fn<typeof fetch>(() => {
    const respond = responders[Math.min(callCount, responders.length - 1)]
    callCount++
    return Promise.resolve(respond())
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderSection() {
  return render(
    <TestProviders>
      <PcDiagnosticsSection pcId={7} />
    </TestProviders>,
  )
}

function valueOf(label: string): string | null {
  return screen.getByText(label).nextElementSibling?.textContent ?? null
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('PcDiagnostics loading', () => {
  it('says diagnostics are loading until the first report arrives', () => {
    stubDiagnostics(() => new Promise<Response>(() => {}))
    renderSection()
    expect(screen.getByRole('status').textContent).toBe('Loading diagnostics…')
  })
})

describe('PcDiagnostics report', () => {
  it('reads the report of the PC from the diagnostics route', async () => {
    const fetchMock = stubDiagnostics(() => Response.json(diagnosticsReport()))
    renderSection()
    await screen.findByText('Last report: 1 minute ago')
    expect(fetchMock).toHaveBeenCalledWith('/api/pcs/7/diagnostics', expect.anything())
  })

  it('shows the service version, client status, client version and sign-in', async () => {
    stubDiagnostics(() => Response.json(diagnosticsReport()))
    renderSection()
    await screen.findByText('Last report: 1 minute ago')

    expect(valueOf('Service version')).toBe('v0.23.0')
    expect(valueOf('Client running')).toBe('No')
    expect(valueOf('Client version')).toBe('v0.22.0')
    expect(valueOf('User signed in')).toBe('Yes')
  })

  it('shows the update line and its error when the update failed', async () => {
    stubDiagnostics(() =>
      Response.json(
        diagnosticsReport({ update: { version: '0.23.0', state: 'failed', error: 'Disk full' } }),
      ),
    )
    renderSection()

    expect(await screen.findByText('Update 0.23.0: Failed')).toBeTruthy()
    expect(screen.getByText('Disk full')).toBeTruthy()
  })

  it('says no update is queued when the PC has none', async () => {
    stubDiagnostics(() => Response.json(diagnosticsReport({ update: null })))
    renderSection()
    expect(await screen.findByText('No update queued.')).toBeTruthy()
  })

  it('lists the events newest first with their level as text', async () => {
    stubDiagnostics(() =>
      Response.json(
        diagnosticsReport({
          events: [
            { at: minutesAgo(5), level: 'information', message: 'Service started' },
            { at: minutesAgo(1), level: 'error', message: 'Client exited unexpectedly' },
          ],
        }),
      ),
    )
    renderSection()

    const items = await screen.findAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Client exited unexpectedly'),
      expect.stringContaining('Service started'),
    ])
    expect(within(items[0]).getByText('Error')).toBeTruthy()
    expect(within(items[1]).getByText('Information')).toBeTruthy()
  })

  it('says no events were reported when the list is empty', async () => {
    stubDiagnostics(() => Response.json(diagnosticsReport({ events: [] })))
    renderSection()
    expect(await screen.findByText('No events reported.')).toBeTruthy()
  })

  it('warns that a report older than 3 minutes may be out of date', async () => {
    stubDiagnostics(() => Response.json(diagnosticsReport({ receivedAt: minutesAgo(10) })))
    renderSection()

    expect(await screen.findByText('Last report: 10 minutes ago')).toBeTruthy()
    expect(screen.getByText(/This report is more than 3 minutes old/)).toBeTruthy()
  })

  it('shows no stale warning for a fresh report', async () => {
    stubDiagnostics(() => Response.json(diagnosticsReport()))
    renderSection()
    await screen.findByText('Last report: 1 minute ago')
    expect(screen.queryByText(/This report is more than 3 minutes old/)).toBeNull()
  })
})

describe('PcDiagnostics empty state', () => {
  it('says the PC has not reported and which client version it needs', async () => {
    stubDiagnostics(() =>
      Response.json({ error: NO_REPORT_MESSAGE }, { status: 404 }),
    )
    renderSection()
    expect(await screen.findByText(DIAGNOSTICS_EMPTY_TEXT)).toBeTruthy()
  })
})

describe('PcDiagnostics error state', () => {
  it('explains that diagnostics could not be loaded and will be retried', async () => {
    stubDiagnostics(() => Response.json({ error: 'Something broke.' }, { status: 500 }))
    renderSection()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain("Couldn't load diagnostics.")
    expect(alert.textContent).toContain('It will try again shortly.')
  })
})

describe('PcDiagnostics refresh', () => {
  it('reads the report again every 15 seconds while it is open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = stubDiagnostics(
      () => Response.json(diagnosticsReport({ clientRunning: false })),
      () => Response.json(diagnosticsReport({ clientRunning: true })),
    )
    renderSection()
    await screen.findByText('Client running')
    expect(valueOf('Client running')).toBe('No')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DIAGNOSTICS_POLL_INTERVAL_MS)
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(valueOf('Client running')).toBe('Yes')
  })

  it('marks the repeat reads as background requests', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = stubDiagnostics(() => Response.json(diagnosticsReport()))
    renderSection()
    await screen.findByText('Client running')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DIAGNOSTICS_POLL_INTERVAL_MS)
    })

    expect(fetchMock.mock.calls[0][1]?.headers).toBeUndefined()
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ 'X-Background-Refresh': '1' })
  })

  it('stops reading the report once the section is closed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = stubDiagnostics(() => Response.json(diagnosticsReport()))
    const { unmount } = renderSection()
    await screen.findByText('Client running')

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DIAGNOSTICS_POLL_INTERVAL_MS * 3)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
