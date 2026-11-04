import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const inputVariants = cva(
  'w-full rounded-md border bg-surface-200 px-3 text-base text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-disabled',
  {
    variants: {
      isMono: {
        true: 'font-mono text-sm',
        false: '',
      },
      hasError: {
        true: 'border-danger',
        false: 'border-border-strong',
      },
    },
    defaultVariants: {
      isMono: false,
      hasError: false,
    },
  },
)

const messageVariants = cva('m-0 flex items-center gap-1.5 text-xs', {
  variants: {
    isError: {
      true: 'font-semibold text-danger',
      false: 'text-ink-muted',
    },
  },
  defaultVariants: {
    isError: false,
  },
})

interface FieldProps extends VariantProps<typeof messageVariants> {
  label: string
  htmlFor: string
  message?: string
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, message, isError, className, children }: FieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold tracking-label text-ink-muted">
        {label}
      </label>
      {children}
      {message && (
        <p id={`${htmlFor}-message`} className={messageVariants({ isError })}>
          {message}
        </p>
      )}
    </div>
  )
}

interface TextInputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

export function TextInput({ className, isMono, hasError, ...props }: TextInputProps) {
  return (
    <input
      className={cn(inputVariants({ isMono, hasError }), 'h-control-md', className)}
      aria-invalid={hasError ? true : undefined}
      {...props}
    />
  )
}

interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof inputVariants> {}

export function TextArea({ className, isMono, hasError, ...props }: TextAreaProps) {
  return (
    <textarea
      className={cn(inputVariants({ isMono, hasError }), 'py-2', className)}
      aria-invalid={hasError ? true : undefined}
      {...props}
    />
  )
}

interface SelectInputProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof inputVariants> {}

export function SelectInput({ className, isMono, hasError, ...props }: SelectInputProps) {
  return (
    <select
      className={cn(inputVariants({ isMono, hasError }), 'h-control-md', className)}
      aria-invalid={hasError ? true : undefined}
      {...props}
    />
  )
}
