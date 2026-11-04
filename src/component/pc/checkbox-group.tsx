import { getSelectionState } from '../../lib/pcs'
import { toggleAllValues, toggleListValue } from '../../lib/restrictions'
import { cn } from '../../lib/utils'
import { Checkbox } from '../ui/choice'

interface CheckboxGroupOption<T extends string> {
  value: T
  label: string
  description?: string
}

interface CheckboxGroupProps<T extends string> {
  legend: string
  options: CheckboxGroupOption<T>[]
  selectedValues: T[]
  onChange: (values: T[]) => void
  isDisabled?: boolean
  className?: string
}

export function CheckboxGroup<T extends string>({
  legend,
  options,
  selectedValues,
  onChange,
  isDisabled = false,
  className,
}: CheckboxGroupProps<T>) {
  const allValues = options.map((option) => option.value)
  const selectionState = getSelectionState(allValues, selectedValues)

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="p-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
        {legend}
      </legend>
      <div className={cn('flex flex-col gap-2', className)}>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-ink">
            <Checkbox
              checked={selectedValues.includes(option.value)}
              disabled={isDisabled}
              onChange={() => onChange(toggleListValue(selectedValues, option.value))}
            />
            <span>
              {option.label}
              {option.description && (
                <span className="ml-2 text-xs text-ink-muted">{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 border-t border-border pt-2 text-ink">
        <Checkbox
          ref={(checkbox) => {
            if (checkbox) checkbox.indeterminate = selectionState === 'some'
          }}
          checked={selectionState === 'all'}
          disabled={isDisabled}
          onChange={() => onChange(toggleAllValues(allValues, selectedValues))}
        />
        Select/Deselect All
      </label>
    </fieldset>
  )
}
