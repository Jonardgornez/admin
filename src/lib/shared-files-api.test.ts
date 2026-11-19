import { afterEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from './api'
import {
  cancelFileTransfers,
  decideFileTransfers,
  getFileTransfers,
  sendFileToPcs,
  UPLOAD_CANCELLED_MESSAGE,
  uploadSharedFile,
} from './shared-files-api'

const sharedFile = { id: 4, name: 'notes.pdf', sizeBytes: 5, sha256: 'a'.repeat(64) }

const transfer = {
  id: 9,
  pcId: 1,
  pcName: 'PC-1',
  fileName: 'notes.pdf',
  sizeBytes: 5,
  folder: 'desktop',
  subfolder: 'Lykantra Share',
  status: 'waiting',
  decision: null,
  savedAs: null,
  error: null,
  waitingReason: 'busy',
  busyWith: 'slides.pptx',
  pcClientVersion: '0.26.0',
  createdUtc: '2026-11-18T10:00:00Z',
  updatedUtc: '2026-11-18T10:00:00Z',
}

// A stand-in for XMLHttpRequest. Each test drives the latest request through its handlers.
class FakeXhr {
  static latest: FakeXhr | null = null
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: unknown = undefined
  status = 0
  responseText = ''
  isAborted = false
  upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = {
    onprogress: null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onabort: (() => void) | null = null

  constructor() {
    FakeXhr.latest = this
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }

  send(body: unknown) {
    this.body = body
  }

  abort() {
    this.isAborted = true
    this.onabort?.()
  }

  respond(status: number, body: unknown) {
    this.status = status
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body)
    this.onload?.()
  }
}

function latestXhr(): FakeXhr {
  if (!FakeXhr.latest) throw new Error('No request was sent.')
  return FakeXhr.latest
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const file = new File(['hello'], 'résumé #1.pdf')

describe('uploadSharedFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeXhr.latest = null
  })

  it('posts the raw bytes with the encoded name and returns the stored file', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const pending = uploadSharedFile(file)
    const xhr = latestXhr()

    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('/api/shared-files')
    expect(xhr.body).toBe(file)
    expect(xhr.headers).toEqual({
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent('résumé #1.pdf'),
    })
    xhr.respond(201, sharedFile)
    expect(await pending).toEqual({ success: true, data: sharedFile })
  })

  it('reports upload progress as a whole percent', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const onProgress = vi.fn()
    const pending = uploadSharedFile(file, { onProgress })
    const xhr = latestXhr()

    xhr.upload.onprogress?.({ loaded: 1, total: 4, lengthComputable: true })
    xhr.upload.onprogress?.({ loaded: 5, total: 0, lengthComputable: false })
    xhr.respond(201, sharedFile)
    await pending

    expect(onProgress.mock.calls).toEqual([[25], [100]])
  })

  it('shows the server error, such as too little disk space', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const pending = uploadSharedFile(file)
    const message = 'The server does not have enough free disk space for this file.'
    latestXhr().respond(507, { error: message })

    expect(await pending).toEqual({ success: false, status: 507, error: message })
  })

  it('fails with the fallback message when the reply does not match the contract', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const pending = uploadSharedFile(file)
    latestXhr().respond(201, { id: 'four' })

    expect(await pending).toEqual({ success: false, status: 201, error: FALLBACK_ERROR_MESSAGE })
  })

  it('returns the network message when the server cannot be reached', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const pending = uploadSharedFile(file)
    latestXhr().onerror?.()

    expect(await pending).toEqual({ success: false, status: 0, error: NETWORK_ERROR_MESSAGE })
  })

  it('stops the upload when the signal aborts', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const controller = new AbortController()
    const pending = uploadSharedFile(file, { signal: controller.signal })

    controller.abort()

    expect(latestXhr().isAborted).toBe(true)
    expect(await pending).toEqual({ success: false, status: 0, error: UPLOAD_CANCELLED_MESSAGE })
  })

  it('does not start when the signal is already aborted', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const controller = new AbortController()
    controller.abort()

    expect(await uploadSharedFile(file, { signal: controller.signal })).toEqual({
      success: false,
      status: 0,
      error: UPLOAD_CANCELLED_MESSAGE,
    })
    expect(FakeXhr.latest).toBeNull()
  })
})

describe('file transfer requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the file to the PCs and returns their transfers', async () => {
    const fetchMock = stubFetch(Response.json({ transfers: [transfer] }))
    const payload = { ids: [1], sharedFileId: 4, folder: 'desktop' as const, subfolder: 'Share' }

    expect(await sendFileToPcs(payload)).toEqual({ success: true, data: [transfer] })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/pcs/files')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(payload)
  })

  it('shows the server error when the send is refused', async () => {
    stubFetch(Response.json({ error: 'Unknown PC.' }, { status: 400 }))
    const payload = { ids: [99], sharedFileId: 4, folder: 'desktop' as const, subfolder: '' }

    expect(await sendFileToPcs(payload)).toEqual({ success: false, status: 400, error: 'Unknown PC.' })
  })

  it('reads the transfers by id as a background request', async () => {
    const fetchMock = stubFetch(Response.json({ transfers: [transfer] }))

    expect(await getFileTransfers([9, 10], { isBackground: true })).toEqual({
      success: true,
      data: [transfer],
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/pcs/files/transfers?ids=9,10')
    expect(init.headers).toEqual({ 'X-Background-Refresh': '1' })
  })

  it('refuses a transfer with an unknown status', async () => {
    stubFetch(Response.json({ transfers: [{ ...transfer, status: 'lost' }] }))

    expect(await getFileTransfers([9])).toEqual({
      success: false,
      status: 200,
      error: FALLBACK_ERROR_MESSAGE,
    })
  })

  it('posts a decision for the transfers', async () => {
    const decided = { ...transfer, status: 'applying', decision: 'keepBoth' }
    const fetchMock = stubFetch(Response.json({ transfers: [decided] }))

    expect(await decideFileTransfers([9], 'keepBoth')).toEqual({ success: true, data: [decided] })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/pcs/files/transfers/decision')
    expect(JSON.parse(init.body as string)).toEqual({ transferIds: [9], decision: 'keepBoth' })
  })

  it('refuses a transfer with an unknown waiting reason', async () => {
    stubFetch(Response.json({ transfers: [{ ...transfer, waitingReason: 'asleep' }] }))

    expect(await getFileTransfers([9])).toEqual({
      success: false,
      status: 200,
      error: FALLBACK_ERROR_MESSAGE,
    })
  })

  it('posts a cancel for the transfers and returns them', async () => {
    const cancelled = { ...transfer, status: 'cancelled', waitingReason: null, busyWith: null }
    const fetchMock = stubFetch(Response.json({ transfers: [cancelled] }))

    expect(await cancelFileTransfers([9, 10])).toEqual({ success: true, data: [cancelled] })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/pcs/files/transfers/cancel')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ transferIds: [9, 10] })
  })

  it('shows the server error when a cancel is refused', async () => {
    stubFetch(Response.json({ error: 'Too many transfers.' }, { status: 400 }))

    expect(await cancelFileTransfers([9])).toEqual({
      success: false,
      status: 400,
      error: 'Too many transfers.',
    })
  })
})
