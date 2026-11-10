import { describe, expect, it } from 'vitest'
import {
  describeClientUpdateCancelResult,
  describeClientUpdateResult,
  formatClientVersion,
  formatInstallerSize,
  formatReleaseUploaded,
  getClientUpdateLabel,
} from './client-updates'

const MB = 1024 * 1024

describe('formatClientVersion', () => {
  it('prefixes the version with v', () => {
    expect(formatClientVersion('0.19.0')).toBe('v0.19.0')
  })

  it.each([null, undefined, ''])('says the version is unknown for %p', (version) => {
    expect(formatClientVersion(version)).toBe('Version unknown')
  })
})

describe('formatInstallerSize', () => {
  it('shows the size in megabytes with one decimal', () => {
    expect(formatInstallerSize(75 * MB)).toBe('75.0 MB')
    expect(formatInstallerSize(150 * MB + MB / 2)).toBe('150.5 MB')
  })
})

describe('formatReleaseUploaded', () => {
  it('prefixes the upload time with Uploaded', () => {
    expect(formatReleaseUploaded('2026-11-10T09:30:00.000Z')).toMatch(/^Uploaded .+/)
  })
})

describe('getClientUpdateLabel', () => {
  const update = { targetVersion: '0.20.0', error: null, installNow: false }
  const idlePc = { name: 'PC-01', status: 'locked' } as const
  const inUsePc = { name: 'PC-01', status: 'in-use' } as const

  it('says a pending update starts soon when the PC is idle', () => {
    expect(getClientUpdateLabel({ ...update, state: 'pending' }, idlePc)).toBe(
      'Update to 0.20.0 starting soon',
    )
  })

  it('says a pending update waits until the PC in use is free', () => {
    expect(getClientUpdateLabel({ ...update, state: 'pending' }, inUsePc)).toBe(
      'Update to 0.20.0 — waits until PC-01 is free',
    )
  })

  it('says a pending install-now update installs after the warning when the PC is in use', () => {
    expect(
      getClientUpdateLabel({ ...update, state: 'pending', installNow: true }, inUsePc),
    ).toBe('Update to 0.20.0 — installing after a 60-second warning')
  })

  it('says a pending install-now update starts soon when the PC is idle', () => {
    expect(
      getClientUpdateLabel({ ...update, state: 'pending', installNow: true }, idlePc),
    ).toBe('Update to 0.20.0 starting soon')
  })

  it('says a pending update waits until a locked PC is unlocked, even with install now', () => {
    const lockedPc = { name: 'PC-01', status: 'frozen' } as const
    expect(getClientUpdateLabel({ ...update, state: 'pending' }, lockedPc)).toBe(
      'Update to 0.20.0 — waits until PC-01 is unlocked',
    )
    expect(
      getClientUpdateLabel({ ...update, state: 'pending', installNow: true }, lockedPc),
    ).toBe('Update to 0.20.0 — waits until PC-01 is unlocked')
  })

  it('says the PC is downloading the update', () => {
    expect(getClientUpdateLabel({ ...update, state: 'downloading' }, idlePc)).toBe(
      'Downloading 0.20.0…',
    )
  })

  it('says the PC is installing the update', () => {
    expect(getClientUpdateLabel({ ...update, state: 'installing' }, idlePc)).toBe(
      'Installing 0.20.0…',
    )
  })

  it('says the update failed, without the version', () => {
    expect(getClientUpdateLabel({ ...update, state: 'failed' }, idlePc)).toBe('Update failed')
  })
})

describe('describeClientUpdateResult', () => {
  it('says how many PCs the update was queued for', () => {
    expect(describeClientUpdateResult(1)).toBe('Update queued for 1 PC.')
    expect(describeClientUpdateResult(3)).toBe('Update queued for 3 PCs.')
  })

  it('says no PC needed the update when none was queued', () => {
    expect(describeClientUpdateResult(0)).toBe('No PCs needed this update.')
  })
})

describe('describeClientUpdateCancelResult', () => {
  it('says how many PCs had their update cancelled', () => {
    expect(describeClientUpdateCancelResult(2)).toBe('Cancelled the update for 2 PCs.')
  })

  it('says no PC had an update to cancel', () => {
    expect(describeClientUpdateCancelResult(0)).toBe('No PCs had an update to cancel.')
  })
})
