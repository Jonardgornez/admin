import { useId } from 'react'
import {
  getCombinedState,
  setCheckStates,
  type CheckState,
  type CheckStates,
} from '../../lib/restrictions'
import { cn } from '../../lib/utils'
import { Checkbox } from '../ui/choice'

export interface CheckboxGroupOption<T extends string> {
  value: T
  label: string
  // A disabled option stays unchecked, shows the note, and is left out of Select/Deselect All.
  disabledNote?: string
}

interface CheckboxGroupProps<T extends string> {
  legend: string
  options: CheckboxGroupOption<T>[]
  states: CheckStates<T>
  onChange: (states: CheckStates<T>) => void
  disabled?: boolean
  className?: string
}

interface TriStateCheckboxProps {
  label: string
  state: CheckState
  disabled: boolean
  describedBy?: string
  onChange: (state: CheckState) => void
}

// Indeterminate while the PCs differ, until the administrator picks a state.
function TriStateCheckbox({ label, state, disabled, describedBy, onChange }: TriStateCheckboxProps) {
  return (
    <label className="flex items-center gap-2 text-ink">
      <Checkbox
        ref={(checkbox) => {
          if (checkbox) checkbox.indeterminate = state === 'mixed'
        }}
        checked={state === 'on'}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked ? 'on' : 'off')}
      />
      {label}
    </label>
  )
}

function DisabledOption({ label, note }: { label: string; note: string }) {
  const noteId = useId()
  return (
    <div className="flex flex-col">
      <TriStateCheckbox label={label} state="off" disabled describedBy={noteId} onChange={() => {}} />
      <span id={noteId} className="ps-6 text-xs text-ink-muted">
        {note}
      </span>
    </div>
  )
}

export function CheckboxGroup<T extends string>({
  legend,
  options,
  states,
  onChange,
  disabled = false,
  className,
}: CheckboxGroupProps<T>) {
  const enabledValues = options.filter((option) => !option.disabledNote).map((option) => option.value)
  const combinedState = getCombinedState(states, enabledValues)

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
        {legend}
      </legend>
      <div className={cn('flex flex-col gap-2', className)}>
        {options.map((option) =>
          option.disabledNote ? (
            <DisabledOption key={option.value} label={option.label} note={option.disabledNote} />
          ) : (
            <TriStateCheckbox
              key={option.value}
              label={option.label}
              state={states[option.value]}
              disabled={disabled}
              onChange={(state) => onChange({ ...states, [option.value]: state })}
            />
          ),
        )}
      </div>
      <div className="border-t border-border pt-2">
        <TriStateCheckbox
          label="Select/Deselect All"
          state={combinedState}
          disabled={disabled}
          onChange={() =>
            onChange(setCheckStates(states, enabledValues, combinedState === 'on' ? 'off' : 'on'))
          }
        />
      </div>
    </fieldset>
  )
}
