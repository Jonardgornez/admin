import { z } from 'zod'
import { MAX_TIME_LIMIT_MINUTES } from './account-schemas'
import { lockScreenMessageSchema } from './lock-message-schema'
import type { AppSettings } from './settings-api'

export const MIN_DEFAULT_MINUTES = 1
export const MIN_IDLE_TIMEOUT_MINUTES = 5
export const MAX_IDLE_TIMEOUT_MINUTES = 480
export const MIN_POWER_COUNTDOWN_SECONDS = 5
export const MAX_POWER_COUNTDOWN_SECONDS = 3600
export const MAX_NOTICE_TEXT_LENGTH = 300

const DEFAULT_MINUTES_MESSAGE =
  `Enter a whole number from ${MIN_DEFAULT_MINUTES} to ${MAX_TIME_LIMIT_MINUTES}.`
const IDLE_TIMEOUT_MESSAGE =
  `Enter a whole number from ${MIN_IDLE_TIMEOUT_MINUTES} to ${MAX_IDLE_TIMEOUT_MINUTES}.`
const POWER_COUNTDOWN_MESSAGE =
  `Enter a whole number from ${MIN_POWER_COUNTDOWN_SECONDS} to ${MAX_POWER_COUNTDOWN_SECONDS}.`
const NOTICE_TEXT_REQUIRED_MESSAGE = 'Enter the notice text, or turn the notice off.'
const NOTICE_TEXT_TOO_LONG_MESSAGE =
  `Notice text must be at most ${MAX_NOTICE_TEXT_LENGTH} characters.`

// Returns the number when the text is a whole number in range, otherwise null.
export function parseWholeNumberInRange(text: string, min: number, max: number): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return value >= min && value <= max ? value : null
}

// The default minutes are checked even for open time, because the server requires them.
export const settingsFormSchema = z
  .object({
    approvalMode: z.enum(['time-limit', 'open-time']),
    defaultMinutes: z.string(),
    isNoticeEnabled: z.boolean(),
    noticeText: z.string(),
    idleTimeoutMinutes: z.string(),
    defaultViewMode: z.enum(['notified', 'anonymous']),
    powerCountdownSeconds: z.string(),
    lockMessage: lockScreenMessageSchema,
  })
  .superRefine((values, context) => {
    const minutes = parseWholeNumberInRange(
      values.defaultMinutes,
      MIN_DEFAULT_MINUTES,
      MAX_TIME_LIMIT_MINUTES,
    )
    if (minutes === null) {
      context.addIssue({
        code: 'custom',
        path: ['defaultMinutes'],
        message: DEFAULT_MINUTES_MESSAGE,
      })
    }

    if (
      parseWholeNumberInRange(
        values.idleTimeoutMinutes,
        MIN_IDLE_TIMEOUT_MINUTES,
        MAX_IDLE_TIMEOUT_MINUTES,
      ) === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['idleTimeoutMinutes'],
        message: IDLE_TIMEOUT_MESSAGE,
      })
    }

    if (
      parseWholeNumberInRange(
        values.powerCountdownSeconds,
        MIN_POWER_COUNTDOWN_SECONDS,
        MAX_POWER_COUNTDOWN_SECONDS,
      ) === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['powerCountdownSeconds'],
        message: POWER_COUNTDOWN_MESSAGE,
      })
    }

    const noticeText = values.noticeText.trim()
    if (noticeText.length > MAX_NOTICE_TEXT_LENGTH) {
      context.addIssue({
        code: 'custom',
        path: ['noticeText'],
        message: NOTICE_TEXT_TOO_LONG_MESSAGE,
      })
    } else if (values.isNoticeEnabled && noticeText === '') {
      context.addIssue({
        code: 'custom',
        path: ['noticeText'],
        message: NOTICE_TEXT_REQUIRED_MESSAGE,
      })
    }
  })

export type SettingsFormValues = z.infer<typeof settingsFormSchema>

export function toSettingsFormValues(settings: AppSettings): SettingsFormValues {
  return {
    approvalMode: settings.defaultApproval.mode,
    defaultMinutes: String(settings.defaultApproval.minutes),
    isNoticeEnabled: settings.notice.isEnabled,
    noticeText: settings.notice.text,
    idleTimeoutMinutes: String(settings.idleTimeoutMinutes),
    defaultViewMode: settings.defaultViewMode,
    powerCountdownSeconds: String(settings.powerCountdownSeconds),
    lockMessage: settings.lockMessage,
  }
}

// Null when a number does not parse. Values that passed settingsFormSchema always build.
export function buildSettingsPayload(values: SettingsFormValues): AppSettings | null {
  const minutes = parseWholeNumberInRange(
    values.defaultMinutes,
    MIN_DEFAULT_MINUTES,
    MAX_TIME_LIMIT_MINUTES,
  )
  const idleTimeoutMinutes = parseWholeNumberInRange(
    values.idleTimeoutMinutes,
    MIN_IDLE_TIMEOUT_MINUTES,
    MAX_IDLE_TIMEOUT_MINUTES,
  )
  const powerCountdownSeconds = parseWholeNumberInRange(
    values.powerCountdownSeconds,
    MIN_POWER_COUNTDOWN_SECONDS,
    MAX_POWER_COUNTDOWN_SECONDS,
  )
  if (minutes === null || idleTimeoutMinutes === null || powerCountdownSeconds === null) {
    return null
  }
  return {
    defaultApproval: { mode: values.approvalMode, minutes },
    notice: { isEnabled: values.isNoticeEnabled, text: values.noticeText.trim() },
    idleTimeoutMinutes,
    defaultViewMode: values.defaultViewMode,
    powerCountdownSeconds,
    lockMessage: values.lockMessage.trim(),
  }
}
