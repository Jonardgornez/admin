import type { SubmitEvent } from 'react'
import type { LogFilters } from '../../lib/logs'
import { Button } from '../ui/button'
import { Field, TextInput } from '../ui/field'

export type LogFilterDraft = Required<LogFilters>

interface LogFiltersFormProps {
  draft: LogFilterDraft
  onDraftChange: (field: keyof LogFilterDraft, value: string) => void
  onApply: () => void
  onClear: () => void
}

export function LogFiltersForm({ draft, onDraftChange, onApply, onClear }: LogFiltersFormProps) {
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    onApply()
  }

  return (
    <form
      aria-label="Filters"
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-200 p-3"
    >
      <Field label="From" htmlFor="log-from" className="w-full sm:w-40">
        <TextInput
          id="log-from"
          isMono
          value={draft.from}
          onChange={(event) => onDraftChange('from', event.target.value)}
        />
      </Field>
      <Field label="To" htmlFor="log-to" className="w-full sm:w-40">
        <TextInput
          id="log-to"
          isMono
          value={draft.to}
          onChange={(event) => onDraftChange('to', event.target.value)}
        />
      </Field>
      <Field label="PC" htmlFor="log-pc" className="w-full sm:w-40">
        <TextInput
          id="log-pc"
          isMono
          value={draft.pc}
          placeholder="All PCs"
          onChange={(event) => onDraftChange('pc', event.target.value)}
        />
      </Field>
      <Field label="User" htmlFor="log-user" className="w-full sm:w-50">
        <TextInput
          id="log-user"
          value={draft.user}
          placeholder="All users"
          onChange={(event) => onDraftChange('user', event.target.value)}
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
