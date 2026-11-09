// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveBlobAsFile } from './file-download'

const OBJECT_URL = 'blob:http://localhost/logs-file'

describe('saveBlobAsFile', () => {
  const createObjectUrl = vi.fn((_blob: Blob | MediaSource) => OBJECT_URL)
  const revokeObjectUrl = vi.fn((_url: string) => {})

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.clearAllMocks()
    // jsdom has no object URL support, so the two static methods are provided for these tests only.
    URL.createObjectURL = createObjectUrl
    URL.revokeObjectURL = revokeObjectUrl
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
    document.body.innerHTML = ''
  })

  it('clicks a temporary download link that points at the blob', () => {
    const blob = new Blob(['id,pc\n'], { type: 'text/csv' })
    const clicked: { href: string; download: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download })
    })

    saveBlobAsFile(blob, 'session-logs.csv')

    expect(createObjectUrl).toHaveBeenCalledWith(blob)
    expect(clicked).toEqual([{ href: OBJECT_URL, download: 'session-logs.csv' }])
  })

  it('removes the temporary link from the page after the click', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    saveBlobAsFile(new Blob(['x']), 'logs.csv')

    expect(document.querySelectorAll('a')).toHaveLength(0)
  })

  it('revokes the object URL once the download has been handed to the browser', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    saveBlobAsFile(new Blob(['x']), 'logs.csv')
    expect(revokeObjectUrl).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(revokeObjectUrl).toHaveBeenCalledWith(OBJECT_URL)
  })
})
