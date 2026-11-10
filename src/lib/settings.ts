import type { ViewMode } from '../types'
import type { ApiResult } from './api'
import { DEFAULT_LOCK_MESSAGE } from './lock-message-schema'
import type { AppSettings, DefaultApproval } from './settings-api'

// Today's values. They are used until the saved settings load, or if they never do.
export const FALLBACK_SETTINGS: AppSettings = {
  defaultApproval: { mode: 'time-limit', minutes: 60 },
  notice: { isEnabled: true, text: 'This computer may be monitored by the administrator.' },
  idleTimeoutMinutes: 30,
  defaultViewMode: 'notified',
  powerCountdownSeconds: 30,
  lockMessage: DEFAULT_LOCK_MESSAGE,
}

export interface ConsoleDefaults {
  defaultApproval: DefaultApproval
  defaultViewMode: ViewMode
  // Null until the saved value loads, or when it never does. Wording must not guess a number.
  powerCountdownSeconds: number | null
  lockMessage: string
}

export const FALLBACK_CONSOLE_DEFAULTS: ConsoleDefaults = {
  defaultApproval: FALLBACK_SETTINGS.defaultApproval,
  defaultViewMode: FALLBACK_SETTINGS.defaultViewMode,
  powerCountdownSeconds: null,
  lockMessage: FALLBACK_SETTINGS.lockMessage,
}

export function toConsoleDefaults(result: ApiResult<AppSettings>): ConsoleDefaults {
  if (!result.success) return FALLBACK_CONSOLE_DEFAULTS
  return {
    defaultApproval: result.data.defaultApproval,
    defaultViewMode: result.data.defaultViewMode,
    powerCountdownSeconds: result.data.powerCountdownSeconds,
    lockMessage: result.data.lockMessage,
  }
}
