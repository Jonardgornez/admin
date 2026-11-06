import { describe, expect, it } from 'vitest'
import type { ApiResult } from './api'
import { FALLBACK_CONSOLE_DEFAULTS, FALLBACK_SETTINGS, toConsoleDefaults } from './settings'
import type { AppSettings } from './settings-api'

const savedSettings: AppSettings = {
  defaultApproval: { mode: 'open-time', minutes: 90 },
  notice: { isEnabled: false, text: '' },
  idleTimeoutMinutes: 15,
  defaultViewMode: 'anonymous',
}

describe('fallback settings', () => {
  it('keep the values the console used before settings existed', () => {
    expect(FALLBACK_SETTINGS.defaultApproval).toEqual({ mode: 'time-limit', minutes: 60 })
    expect(FALLBACK_SETTINGS.defaultViewMode).toBe('notified')
    expect(FALLBACK_SETTINGS.idleTimeoutMinutes).toBe(30)
  })
})

describe('toConsoleDefaults', () => {
  it('takes the approval default and view mode from saved settings', () => {
    const result: ApiResult<AppSettings> = { success: true, data: savedSettings }
    expect(toConsoleDefaults(result)).toEqual({
      defaultApproval: { mode: 'open-time', minutes: 90 },
      defaultViewMode: 'anonymous',
    })
  })

  it('falls back to the earlier values when settings fail to load', () => {
    const result: ApiResult<AppSettings> = { success: false, status: 500, error: 'Try later.' }
    expect(toConsoleDefaults(result)).toEqual(FALLBACK_CONSOLE_DEFAULTS)
    expect(FALLBACK_CONSOLE_DEFAULTS).toEqual({
      defaultApproval: { mode: 'time-limit', minutes: 60 },
      defaultViewMode: 'notified',
    })
  })

  it('falls back when the session has ended', () => {
    const result: ApiResult<AppSettings> = { success: false, status: 401, error: 'Sign in again.' }
    expect(toConsoleDefaults(result)).toEqual(FALLBACK_CONSOLE_DEFAULTS)
  })
})
