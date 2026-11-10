// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TestProviders } from '../../test/test-providers'
import { useClientUpdates } from './use-client-updates'

type Release = {
  version: string
  sha256: string
  sizeBytes: number
  uploadedAtUtc: string
}

const RELEASE: Release = {
  version: '0.20.0',
  sha256: 'a'.repeat(64),
  sizeBytes: 75 * 1024 * 1024,
  uploadedAtUtc: '2026-11-10T09:30:00.000Z',
}

const NEW_RELEASE: Release = { ...RELEASE, version: '0.21.0', sha256: 'b'.repeat(64) }

const CHANGED_MESSAGE = 'The uploaded update changed. Check the version and try again.'

type QueuePcIds = (pcIds: number[], version: string) => Promise<unknown>
type CancelPcIds = (pcIds: number[]) => Promise<unknown>

// The server's release can change between calls, which the tests control through setRelease.
function stubReleaseFetch(initialRelease: Release | null) {
  const state = { release: initialRelease }
  const fetchMock = vi.fn(() => Promise.resolve(Response.json({ release: state.release })))
  vi.stubGlobal('fetch', fetchMock)
  return {
    fetchMock,
    setRelease: (release: Release | null) => {
      state.release = release
    },
  }
}

function renderUpdates(
  queuePcIds: QueuePcIds = vi.fn(),
  cancelPcIds: CancelPcIds = vi.fn(),
) {
  const notify = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestProviders notify={notify}>{children}</TestProviders>
  )
  const hook = renderHook(
    () =>
      useClientUpdates({
        queuePcIds: queuePcIds as Parameters<typeof useClientUpdates>[0]['queuePcIds'],
        cancelPcIds: cancelPcIds as Parameters<typeof useClientUpdates>[0]['cancelPcIds'],
      }),
    { wrapper },
  )
  return { ...hook, notify }
}

type UpdatesResult = ReturnType<typeof renderUpdates>['result']

async function openUpdate(result: UpdatesResult, pcIds = [1, 2], includesServerPc = false) {
  await act(async () => {
    await result.current.openUpdate(pcIds, includesServerPc)
  })
}

async function confirmUpdate(result: UpdatesResult) {
  await act(async () => {
    await result.current.confirmUpdate(result.current.updateTarget!)
  })
}

describe('useClientUpdates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the release when the Dashboard opens', async () => {
    const { fetchMock } = stubReleaseFetch(RELEASE)
    renderUpdates()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/client-updates', expect.anything())
  })

  it('reads the release again when the Update dialog opens, so it shows the current version', async () => {
    const { fetchMock, setRelease } = stubReleaseFetch(RELEASE)
    const { result } = renderUpdates()
    await waitFor(() => expect(result.current.release).toEqual(RELEASE))

    setRelease(NEW_RELEASE)
    await openUpdate(result)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.updateTarget?.release).toEqual(NEW_RELEASE)
  })

  it('does not open the update when no release is uploaded, and says so', async () => {
    stubReleaseFetch(null)
    const { result, notify } = renderUpdates()

    await openUpdate(result)

    expect(result.current.updateTarget).toBeNull()
    expect(notify).toHaveBeenCalledWith('Upload a client installer first.', 'alert')
  })

  it('opens the update for the PCs, with the release and whether the server PC is among them', async () => {
    stubReleaseFetch(RELEASE)
    const { result } = renderUpdates()

    await openUpdate(result, [1, 2], true)

    expect(result.current.updateTarget).toEqual({
      pcIds: [1, 2],
      includesServerPc: true,
      release: RELEASE,
    })
  })

  it('queues the update for the version the admin saw, then closes and reports the count', async () => {
    stubReleaseFetch(RELEASE)
    const queuePcIds = vi.fn(() => Promise.resolve({ success: true, data: { affected: 2 } }))
    const { result, notify } = renderUpdates(queuePcIds)
    await openUpdate(result)

    await confirmUpdate(result)

    expect(queuePcIds).toHaveBeenCalledWith([1, 2], '0.20.0')
    expect(result.current.updateTarget).toBeNull()
    expect(notify).toHaveBeenCalledWith('Update queued for 2 PCs.', 'download')
  })

  it('says no PC needed the update when the server reaches none', async () => {
    stubReleaseFetch(RELEASE)
    const queuePcIds = vi.fn(() => Promise.resolve({ success: true, data: { affected: 0 } }))
    const { result, notify } = renderUpdates(queuePcIds)
    await openUpdate(result, [1])

    await confirmUpdate(result)

    expect(notify).toHaveBeenCalledWith('No PCs needed this update.', 'download')
  })

  it('keeps the dialog open when the same command is still running', async () => {
    stubReleaseFetch(RELEASE)
    const queuePcIds = vi.fn(() => Promise.resolve(null))
    const { result, notify } = renderUpdates(queuePcIds)
    await openUpdate(result, [1])

    await confirmUpdate(result)

    expect(result.current.updateTarget).toMatchObject({ pcIds: [1] })
    expect(notify).not.toHaveBeenCalled()
  })

  it('shows the changed-upload message in the dialog and switches it to the new release', async () => {
    const { setRelease } = stubReleaseFetch(RELEASE)
    const queuePcIds = vi.fn(() =>
      Promise.resolve({ success: false, status: 409, error: CHANGED_MESSAGE }),
    )
    const { result, notify } = renderUpdates(queuePcIds)
    await openUpdate(result)
    setRelease(NEW_RELEASE)

    await confirmUpdate(result)

    expect(result.current.updateTarget).toEqual({
      pcIds: [1, 2],
      includesServerPc: false,
      release: NEW_RELEASE,
    })
    expect(result.current.updateError).toBe(CHANGED_MESSAGE)
    expect(notify).not.toHaveBeenCalled()
  })

  it('closes the dialog and reports the message when the upload was removed meanwhile', async () => {
    const { setRelease } = stubReleaseFetch(RELEASE)
    const queuePcIds = vi.fn(() =>
      Promise.resolve({ success: false, status: 409, error: 'Upload a client installer first.' }),
    )
    const { result, notify } = renderUpdates(queuePcIds)
    await openUpdate(result)
    setRelease(null)

    await confirmUpdate(result)

    expect(result.current.updateTarget).toBeNull()
    expect(notify).toHaveBeenCalledWith('Upload a client installer first.', 'alert')
  })

  it('reports another server error as an alert and closes the dialog', async () => {
    stubReleaseFetch(RELEASE)
    const queuePcIds = vi.fn(() =>
      Promise.resolve({ success: false, status: 500, error: 'Server is busy.' }),
    )
    const { result, notify } = renderUpdates(queuePcIds)
    await openUpdate(result)

    await confirmUpdate(result)

    expect(notify).toHaveBeenCalledWith('Server is busy.', 'alert')
    expect(result.current.updateTarget).toBeNull()
  })

  it('cancels the updates of the given PCs and reports how many were cleared', async () => {
    stubReleaseFetch(RELEASE)
    const cancelPcIds = vi.fn(() => Promise.resolve({ success: true, data: { affected: 1 } }))
    const { result, notify } = renderUpdates(vi.fn(), cancelPcIds)

    await act(async () => {
      await result.current.cancelUpdates([7])
    })

    expect(cancelPcIds).toHaveBeenCalledWith([7])
    expect(notify).toHaveBeenCalledWith('Cancelled the update for 1 PC.', 'x')
  })
})
