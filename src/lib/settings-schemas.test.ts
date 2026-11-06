import { describe, expect, it } from 'vitest'
import type { AppSettings } from './settings-api'
import {
  buildSettingsPayload,
  MAX_NOTICE_TEXT_LENGTH,
  parseWholeNumberInRange,
  settingsFormSchema,
  toSettingsFormValues,
  type SettingsFormValues,
} from './settings-schemas'

const valid: SettingsFormValues = {
  approvalMode: 'time-limit',
  defaultMinutes: '60',
  isNoticeEnabled: true,
  noticeText: 'This computer may be monitored.',
  idleTimeoutMinutes: '30',
  defaultViewMode: 'notified',
  powerCountdownSeconds: '30',
}

function errorsFor(values: Partial<SettingsFormValues>): Record<string, string> {
  const result = settingsFormSchema.safeParse({ ...valid, ...values })
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    errors[String(issue.path[0])] ??= issue.message
  }
  return errors
}

const savedSettings: AppSettings = {
  defaultApproval: { mode: 'open-time', minutes: 90 },
  notice: { isEnabled: false, text: 'Off for now.' },
  idleTimeoutMinutes: 15,
  defaultViewMode: 'anonymous',
  powerCountdownSeconds: 45,
}

describe('parseWholeNumberInRange', () => {
  it('accepts whole numbers at both ends of the range', () => {
    expect(parseWholeNumberInRange('5', 5, 480)).toBe(5)
    expect(parseWholeNumberInRange('480', 5, 480)).toBe(480)
  })

  it('trims surrounding spaces', () => {
    expect(parseWholeNumberInRange(' 42 ', 1, 100)).toBe(42)
  })

  it.each(['4', '481', '', '  ', '1.5', '-5', '1e3', 'abc', '5 minutes'])(
    'rejects %j',
    (text) => {
      expect(parseWholeNumberInRange(text, 5, 480)).toBeNull()
    },
  )
})

describe('settingsFormSchema', () => {
  it('accepts the valid values', () => {
    expect(errorsFor({})).toEqual({})
  })

  describe('default minutes', () => {
    it.each(['1', '1440'])('accepts %j', (defaultMinutes) => {
      expect(errorsFor({ defaultMinutes })).toEqual({})
    })

    it.each(['0', '1441', '', 'abc', '2.5'])('rejects %j', (defaultMinutes) => {
      expect(errorsFor({ defaultMinutes }).defaultMinutes).toBe(
        'Enter a whole number from 1 to 1440.',
      )
    })

    it('still checks the minutes when open time is chosen', () => {
      expect(errorsFor({ approvalMode: 'open-time', defaultMinutes: '' }).defaultMinutes).toBe(
        'Enter a whole number from 1 to 1440.',
      )
    })
  })

  describe('idle timeout', () => {
    it.each(['5', '480'])('accepts %j', (idleTimeoutMinutes) => {
      expect(errorsFor({ idleTimeoutMinutes })).toEqual({})
    })

    it.each(['4', '481', '', 'soon'])('rejects %j', (idleTimeoutMinutes) => {
      expect(errorsFor({ idleTimeoutMinutes }).idleTimeoutMinutes).toBe(
        'Enter a whole number from 5 to 480.',
      )
    })
  })

  describe('power countdown', () => {
    it.each(['5', '3600'])('accepts %j', (powerCountdownSeconds) => {
      expect(errorsFor({ powerCountdownSeconds })).toEqual({})
    })

    it.each(['4', '3601', '', '30.5', 'soon', '-5'])('rejects %j', (powerCountdownSeconds) => {
      expect(errorsFor({ powerCountdownSeconds }).powerCountdownSeconds).toBe(
        'Enter a whole number from 5 to 3600.',
      )
    })
  })

  describe('notice text', () => {
    it('requires text when the notice is on, including text that is only spaces', () => {
      expect(errorsFor({ noticeText: '' }).noticeText).toBe(
        'Enter the notice text, or turn the notice off.',
      )
      expect(errorsFor({ noticeText: '   ' }).noticeText).toBe(
        'Enter the notice text, or turn the notice off.',
      )
    })

    it('does not require text when the notice is off', () => {
      expect(errorsFor({ isNoticeEnabled: false, noticeText: '' })).toEqual({})
    })

    it('accepts exactly 300 characters and rejects 301, counted after trimming', () => {
      expect(errorsFor({ noticeText: 'a'.repeat(MAX_NOTICE_TEXT_LENGTH) })).toEqual({})
      expect(errorsFor({ noticeText: `  ${'a'.repeat(301)}  ` }).noticeText).toBe(
        'Notice text must be at most 300 characters.',
      )
    })

    it('still rejects a long text when the notice is off', () => {
      expect(
        errorsFor({ isNoticeEnabled: false, noticeText: 'a'.repeat(301) }).noticeText,
      ).toBe('Notice text must be at most 300 characters.')
    })
  })

  it('rejects an unknown approval mode and view mode', () => {
    expect(errorsFor({ approvalMode: 'forever' as 'time-limit' }).approvalMode).toBeDefined()
    expect(errorsFor({ defaultViewMode: 'hidden' as 'notified' }).defaultViewMode).toBeDefined()
  })
})

describe('toSettingsFormValues', () => {
  it('turns saved settings into form values', () => {
    expect(toSettingsFormValues(savedSettings)).toEqual({
      approvalMode: 'open-time',
      defaultMinutes: '90',
      isNoticeEnabled: false,
      noticeText: 'Off for now.',
      idleTimeoutMinutes: '15',
      defaultViewMode: 'anonymous',
      powerCountdownSeconds: '45',
    })
  })
})

describe('buildSettingsPayload', () => {
  it('turns form values into the settings the server expects', () => {
    expect(
      buildSettingsPayload({
        ...valid,
        approvalMode: 'open-time',
        defaultMinutes: ' 90 ',
        idleTimeoutMinutes: '15',
        defaultViewMode: 'anonymous',
        noticeText: '  Watched.  ',
        powerCountdownSeconds: ' 45 ',
      }),
    ).toEqual({
      defaultApproval: { mode: 'open-time', minutes: 90 },
      notice: { isEnabled: true, text: 'Watched.' },
      idleTimeoutMinutes: 15,
      defaultViewMode: 'anonymous',
      powerCountdownSeconds: 45,
    })
  })

  it('round-trips saved settings', () => {
    expect(buildSettingsPayload(toSettingsFormValues(savedSettings))).toEqual(savedSettings)
  })

  it('returns null when a number does not parse', () => {
    expect(buildSettingsPayload({ ...valid, defaultMinutes: 'abc' })).toBeNull()
    expect(buildSettingsPayload({ ...valid, idleTimeoutMinutes: '' })).toBeNull()
    expect(buildSettingsPayload({ ...valid, powerCountdownSeconds: '' })).toBeNull()
  })
})
