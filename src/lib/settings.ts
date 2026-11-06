import type { ViewMode } from '../types'
import type { ApiResult } from './api'
import type { AppSettings, DefaultApproval } from './settings-api'

// Today's values. They are used until the saved settings load, or if they never do.
export const FALLBACK_SETTINGS: AppSettings = {
  defaultApproval: { mode: 'time-limit', minutes: 60 },
  notice: { isEnabled: true, text: 'This computer may be monitored by the administrator.' },
  idleTimeoutMinutes: 30,
  defaultViewMode: 'notified',
}

export interface ConsoleDefaults {
  defaultApproval: DefaultApproval
  defaultViewMode: ViewMode
}

export const FALLBACK_CONSOLE_DEFAULTS: ConsoleDefaults = {
  defaultApproval: FALLBACK_SETTINGS.defaultApproval,
  defaultViewMode: FALLBACK_SETTINGS.defaultViewMode,
}

export function toConsoleDefaults(result: ApiResult<AppSettings>): ConsoleDefaults {
  if (!result.success) return FALLBACK_CONSOLE_DEFAULTS
  return {
    defaultApproval: result.data.defaultApproval,
    defaultViewMode: result.data.defaultViewMode,
  }
}
