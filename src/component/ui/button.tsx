import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Link, type LinkProps } from 'react-router'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-disabled',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-on-brand enabled:hover:bg-brand-strong',
        secondary:
          'border-border-strong bg-surface-200 text-ink enabled:hover:bg-surface-300',
        danger: 'bg-danger text-on-danger enabled:hover:bg-danger/90',
        ghost: 'bg-transparent text-ink enabled:hover:bg-surface-300',
      },
      size: {
        sm: 'h-control-sm px-3 text-sm',
        md: 'h-control-md px-4 text-base',
        lg: 'h-control-lg px-6 text-lg',
      },
      isIconOnly: {
        true: 'px-0',
        false: '',
      },
    },
    compoundVariants: [
      { isIconOnly: true, size: 'sm', className: 'w-control-sm' },
      { isIconOnly: true, size: 'md', className: 'w-control-md' },
      { isIconOnly: true, size: 'lg', className: 'w-control-lg' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      isIconOnly: false,
    },
  },
)

interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

interface ButtonLinkProps extends LinkProps, VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  isIconOnly,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, isIconOnly }), className)}
      {...props}
    />
  )
}

export function ButtonLink({
  className,
  variant,
  size,
  isIconOnly,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, isIconOnly }), className)}
      {...props}
    />
  )
}
