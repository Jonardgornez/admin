import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'

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
  idleTimeoutMinutes: z.number().int(),
  defaultViewMode: z.enum(['notified', 'anonymous']),
  powerCountdownSeconds: z.number().int(),
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
