import { describe, expect, it } from 'vitest'
import { makeTransfer } from '../test/file-transfer-fixtures'
import type { FileTransfer } from '../types'
import {
  describeTransferDetail,
  describeTransferSummary,
  formatFileSize,
  getCancellableTransfers,
  getExistingTransfers,
  getSendFileTargetLimitError,
  hasPendingTransfers,
  isFinalTransferStatus,
  mergeTransfers,
  toUploadPercent,
} from './file-transfers'

describe('isFinalTransferStatus and hasPendingTransfers', () => {
  it('treats saved, skipped, failed, expired and cancelled as final', () => {
    expect(['saved', 'skipped', 'failed', 'expired', 'cancelled'].every((status) =>
      isFinalTransferStatus(status as FileTransfer['status']),
    )).toBe(true)
    expect(['waiting', 'downloading', 'exists', 'applying'].some((status) =>
      isFinalTransferStatus(status as FileTransfer['status']),
    )).toBe(false)
  })

  it('is pending while any transfer can still change', () => {
    expect(hasPendingTransfers([makeTransfer(1, { status: 'saved' }), makeTransfer(2)])).toBe(true)
    expect(hasPendingTransfers([makeTransfer(1, { status: 'saved' })])).toBe(false)
  })
})

describe('getExistingTransfers', () => {
  it('keeps only the transfers waiting for a decision', () => {
    const existing = makeTransfer(2, { status: 'exists' })
    expect(getExistingTransfers([makeTransfer(1), existing])).toEqual([existing])
  })
})

describe('getCancellableTransfers', () => {
  it('keeps the transfers that have not reached a final status', () => {
    const pending = (['waiting', 'downloading', 'exists', 'applying'] as const).map((status, index) =>
      makeTransfer(index + 1, { status }),
    )
    const final = (['saved', 'skipped', 'failed', 'expired', 'cancelled'] as const).map((status, index) =>
      makeTransfer(index + 10, { status }),
    )
    expect(getCancellableTransfers([...pending, ...final])).toEqual(pending)
  })
})

describe('mergeTransfers', () => {
  it('takes the newer copy of each transfer and keeps ones not in the reply', () => {
    const current = [makeTransfer(1), makeTransfer(2)]
    const updated = makeTransfer(1, { status: 'saved', updatedUtc: '2026-11-18T10:01:00Z' })
    expect(mergeTransfers(current, [updated])).toEqual([updated, current[1]])
  })

  it('ignores an older copy, so a slow poll cannot undo a decision', () => {
    const applying = makeTransfer(1, { status: 'applying', updatedUtc: '2026-11-18T10:02:00Z' })
    const stale = makeTransfer(1, { status: 'exists', updatedUtc: '2026-11-18T10:01:00Z' })
    expect(mergeTransfers([applying], [stale])).toEqual([applying])
  })
})

describe('describeTransferDetail', () => {
  it('names the saved file, the existing location, the failure and the expiry', () => {
    expect(describeTransferDetail(makeTransfer(1, { status: 'saved', savedAs: 'notes (2).pdf' }))).toBe(
      'Saved as notes (2).pdf',
    )
    expect(describeTransferDetail(makeTransfer(1, { status: 'exists' }))).toBe(
      'Already exists in Desktop\\Lykantra Share',
    )
    expect(describeTransferDetail(makeTransfer(1, { status: 'failed', error: 'Not enough free space' }))).toBe(
      'Not enough free space',
    )
    expect(describeTransferDetail(makeTransfer(1, { status: 'failed' }))).toBe(
      'The PC did not say why it failed.',
    )
    expect(describeTransferDetail(makeTransfer(1, { status: 'expired' }))).toBe(
      'The PC did not pick up the file within an hour.',
    )
  })

  it('has no detail while waiting without a reason, downloading or cancelled', () => {
    expect(describeTransferDetail(makeTransfer(1))).toBeNull()
    expect(describeTransferDetail(makeTransfer(1, { status: 'downloading' }))).toBeNull()
    expect(describeTransferDetail(makeTransfer(1, { status: 'cancelled' }))).toBeNull()
  })

  it('says why a transfer is still waiting', () => {
    expect(describeTransferDetail(makeTransfer(1, { waitingReason: 'offline' }))).toBe(
      'PC is offline. It gets the file if it comes back within 1 hour.',
    )
    expect(describeTransferDetail(makeTransfer(1, { waitingReason: 'busy', busyWith: 'slides.pptx' }))).toBe(
      'PC is still receiving slides.pptx.',
    )
    expect(describeTransferDetail(makeTransfer(1, { waitingReason: 'busy' }))).toBe(
      'PC is still receiving another file.',
    )
  })

  it('names the needed and the installed client version when the client is too old', () => {
    expect(
      describeTransferDetail(makeTransfer(1, { waitingReason: 'clientTooOld', pcClientVersion: '0.25.3' })),
    ).toBe('PC needs client 0.26.0 or newer (it has 0.25.3). Update it from the dashboard.')
    expect(
      describeTransferDetail(makeTransfer(1, { waitingReason: 'clientTooOld', pcClientVersion: null })),
    ).toBe('PC needs client 0.26.0 or newer (it has an unknown version). Update it from the dashboard.')
  })

  it('ignores a waiting reason once the transfer has moved on', () => {
    expect(
      describeTransferDetail(makeTransfer(1, { status: 'downloading', waitingReason: 'offline' })),
    ).toBeNull()
  })
})

describe('describeTransferSummary', () => {
  it('counts the saved transfers', () => {
    expect(describeTransferSummary([makeTransfer(1, { status: 'saved' }), makeTransfer(2)])).toBe(
      'Saved on 1 of 2 PCs.',
    )
    expect(describeTransferSummary([makeTransfer(1)])).toBe('Saved on 0 of 1 PC.')
  })
})

describe('getSendFileTargetLimitError', () => {
  it('refuses more than 200 PCs', () => {
    expect(getSendFileTargetLimitError(200)).toBeUndefined()
    expect(getSendFileTargetLimitError(201)).toBe('Choose 200 PCs or fewer.')
  })
})

describe('formatFileSize', () => {
  it('uses KB, MB or GB', () => {
    expect(formatFileSize(10)).toBe('1 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3.00 GB')
  })
})

describe('toUploadPercent', () => {
  it('gives a whole percent capped at 100, and 0 for an unknown total', () => {
    expect(toUploadPercent(1, 3)).toBe(33)
    expect(toUploadPercent(5, 4)).toBe(100)
    expect(toUploadPercent(5, 0)).toBe(0)
  })
})
