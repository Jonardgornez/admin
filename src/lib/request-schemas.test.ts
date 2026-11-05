import { describe, expect, it } from 'vitest'
import { approvalFormSchema, buildApprovalChoice } from './request-schemas'

function minutesError(minutes: string, approvalMode = 'time-limit'): string | undefined {
  const result = approvalFormSchema.safeParse({ approvalMode, minutes })
  if (result.success) return undefined
  return result.error.issues.find((issue) => issue.path[0] === 'minutes')?.message
}

describe('approvalFormSchema', () => {
  it.each(['1', '60', '1440', ' 30 '])('accepts %j minutes', (minutes) => {
    expect(minutesError(minutes)).toBeUndefined()
  })

  it.each(['0', '1.5', '', '   ', 'abc', '-5', '1e3'])(
    'rejects %j as not a whole number of 1 or more',
    (minutes) => {
      expect(minutesError(minutes)).toBe('Enter a whole number of 1 or more.')
    },
  )

  it.each(['1441', '99999'])('rejects %j as over 24 hours', (minutes) => {
    expect(minutesError(minutes)).toBe('Time limit can be at most 1440 minutes (24 hours).')
  })

  it.each(['', '0', '1441', 'abc'])('ignores %j for open time', (minutes) => {
    expect(minutesError(minutes, 'open-time')).toBeUndefined()
  })

  it('rejects an unknown mode', () => {
    expect(approvalFormSchema.safeParse({ approvalMode: 'forever', minutes: '5' }).success).toBe(
      false,
    )
  })
})

describe('buildApprovalChoice', () => {
  it('builds a time limit in minutes', () => {
    expect(buildApprovalChoice({ approvalMode: 'time-limit', minutes: '45' })).toEqual({
      mode: 'time-limit',
      minutes: 45,
    })
  })

  it('builds open time without minutes', () => {
    expect(buildApprovalChoice({ approvalMode: 'open-time', minutes: 'abc' })).toEqual({
      mode: 'open-time',
    })
  })

  it('returns null for an invalid time limit', () => {
    expect(buildApprovalChoice({ approvalMode: 'time-limit', minutes: '1.5' })).toBeNull()
  })
})
