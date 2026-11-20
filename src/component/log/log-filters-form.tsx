import type { SubmitEvent } from 'react'
import { LOG_PERIOD_KINDS, type LogPeriod, type LogPeriodKind } from '../../lib/logs'
import { Button } from '../ui/button'
import { Field, SelectInput, TextInput } from '../ui/field'
import type { PcOption } from './use-pc-options'

// PcId is the chosen PC's id as text, or '' for All PCs.
export interface LogFilterDraft {
  period: LogPeriod
  pcId: string
  user: string
}

const PERIOD_LABELS: Record<LogPeriodKind, string> = {
  all: 'All time',
  day: 'Day',
  month: 'Month',
}

interface LogFiltersFormProps {
  draft: LogFilterDraft
  pcOptions: PcOption[]
  onDraftChange: (draft: LogFilterDraft) => void
  onApply: () => void
  onClear: () => void
}

export function LogFiltersForm({ draft, pcOptions, onDraftChange, onApply, onClear }: LogFiltersFormProps) {
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    onApply()
  }

  function changePeriod(change: Partial<LogPeriod>) {
    onDraftChange({ ...draft, period: { ...draft.period, ...change } })
  }

  return (
    <form
      aria-label="Filters"
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-200 p-3"
    >
      <Field label="Show" htmlFor="log-period" className="w-full sm:w-36">
        <SelectInput
          id="log-period"
          value={draft.period.kind}
          onChange={(event) =>
            changePeriod({ kind: LOG_PERIOD_KINDS.find((kind) => kind === event.target.value) ?? 'all' })
          }
        >
          {LOG_PERIOD_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {PERIOD_LABELS[kind]}
            </option>
          ))}
        </SelectInput>
      </Field>
      {draft.period.kind === 'day' && (
        <Field label="Day" htmlFor="log-day" className="w-full sm:w-44">
          <TextInput
            id="log-day"
            type="date"
            isMono
            required
            value={draft.period.day}
            onChange={(event) => changePeriod({ day: event.target.value })}
          />
        </Field>
      )}
      {draft.period.kind === 'month' && (
        <Field label="Month" htmlFor="log-month" className="w-full sm:w-44">
          <TextInput
            id="log-month"
            type="month"
            isMono
            required
            placeholder="yyyy-mm"
            value={draft.period.month}
            onChange={(event) => changePeriod({ month: event.target.value })}
          />
        </Field>
      )}
      <Field label="PC" htmlFor="log-pc" className="w-full sm:w-44">
        <SelectInput
          id="log-pc"
          isMono
          value={draft.pcId}
          onChange={(event) => onDraftChange({ ...draft, pcId: event.target.value })}
        >
          <option value="">All PCs</option>
          {pcOptions.map((pc) => (
            <option key={pc.id} value={String(pc.id)}>
              {pc.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="User" htmlFor="log-user" className="w-full sm:w-50">
        <TextInput
          id="log-user"
          value={draft.user}
          placeholder="All users"
          onChange={(event) => onDraftChange({ ...draft, user: event.target.value })}
        />
      </Field>
      <Button type="submit" variant="secondary">
        Apply filters
      </Button>
      <Button variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </form>
  )
}
