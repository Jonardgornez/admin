import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

const choiceInputClassName =
  'm-0 size-4.5 cursor-pointer accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-disabled'

type ChoiceInputProps = Omit<ComponentProps<'input'>, 'type'>

export function Checkbox({ className, ...props }: ChoiceInputProps) {
  return <input type="checkbox" className={cn(choiceInputClassName, className)} {...props} />
}

export function RadioOption({ className, children, ...props }: ChoiceInputProps) {
  return (
    <label className="flex items-center gap-2">
      <input type="radio" className={cn(choiceInputClassName, className)} {...props} />
      {children}
    </label>
  )
}
