import { z } from 'zod'
import type { ApprovalChoice } from '../types'
import { MAX_TIME_LIMIT_MINUTES } from './account-schemas'
import { getFormDefaultTime } from './accounts'
import type { DefaultApproval } from './settings-api'

export const approvalFormSchema = z
  .object({
    approvalMode: z.enum(['time-limit', 'open-time']),
    minutes: z.string(),
  })
  .superRefine((values, context) => {
    if (values.approvalMode !== 'time-limit') return
    const choice = buildApprovalChoice(values)
    if (choice === null) {
      context.addIssue({
        code: 'custom',
        path: ['minutes'],
        message: 'Enter a whole number of 1 or more.',
      })
    } else if (choice.mode === 'time-limit' && choice.minutes > MAX_TIME_LIMIT_MINUTES) {
      context.addIssue({
        code: 'custom',
        path: ['minutes'],
        message: `Time limit can be at most ${MAX_TIME_LIMIT_MINUTES} minutes (24 hours).`,
      })
    }
  })

export type ApprovalFormValues = z.infer<typeof approvalFormSchema>

export function getApprovalFormDefaults(defaultApproval: DefaultApproval): ApprovalFormValues {
  return { approvalMode: defaultApproval.mode, minutes: String(defaultApproval.minutes) }
}

export function buildApprovalChoice(values: ApprovalFormValues): ApprovalChoice | null {
  return getFormDefaultTime({
    timeMode: values.approvalMode,
    timeAmount: values.minutes,
    timeUnit: 'minutes',
  })
}
