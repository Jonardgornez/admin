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
  const update = { targetVersion: '0.20.0', error: null }

  it('says an update is waiting for a PC that has not started it', () => {
    expect(getClientUpdateLabel({ ...update, state: 'pending' })).toBe('Update to 0.20.0 waiting')
  })

  it('says the PC is downloading the update', () => {
    expect(getClientUpdateLabel({ ...update, state: 'downloading' })).toBe('Downloading 0.20.0…')
  })

  it('says the PC is installing the update', () => {
    expect(getClientUpdateLabel({ ...update, state: 'installing' })).toBe('Installing 0.20.0…')
  })

  it('says the update failed, without the version', () => {
    expect(getClientUpdateLabel({ ...update, state: 'failed' })).toBe('Update failed')
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
