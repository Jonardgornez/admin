import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'
import { DEFAULT_LOCK_MESSAGE } from './lock-message-schema'
import {
  MAX_IDLE_TIMEOUT_MINUTES,
  MIN_IDLE_TIMEOUT_MINUTES,
  NEVER_IDLE_TIMEOUT_MINUTES,
} from './settings-schemas'

const defaultApprovalSchema = z.object({
  mode: z.enum(['time-limit', 'open-time']),
  minutes: z.number().int(),
})

const settingsSchema = z.object({
  defaultApproval: defaultApprovalSchema,
  notice: z.object({
    isEnabled: z.boolean(),
    text: z.string(),
  }),
  // 0 means the admin stays signed in until they sign out.
  idleTimeoutMinutes: z
    .number()
    .int()
    .refine(
      (minutes) =>
        minutes === NEVER_IDLE_TIMEOUT_MINUTES ||
        (minutes >= MIN_IDLE_TIMEOUT_MINUTES && minutes <= MAX_IDLE_TIMEOUT_MINUTES),
    ),
  defaultViewMode: z.enum(['notified', 'anonymous']),
  powerCountdownSeconds: z.number().int(),
  // An older server omits this, so the built-in default stands in until it is restarted.
  lockMessage: z.string().default(DEFAULT_LOCK_MESSAGE),
})

export type DefaultApproval = z.infer<typeof defaultApprovalSchema>

export type AppSettings = z.infer<typeof settingsSchema>

export async function getSettings(): Promise<ApiResult<AppSettings>> {
  return parseBody(await apiRequest<unknown>('/api/settings'), settingsSchema, OK_STATUS)
}

export async function saveSettings(settings: AppSettings): Promise<ApiResult<AppSettings>> {
  return parseBody(
    await apiRequest<unknown>('/api/settings', { method: 'PUT', body: settings }),
    settingsSchema,
    OK_STATUS,
  )
}
