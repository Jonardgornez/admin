import { useLayoutEffect, useRef, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const modalVariants = cva(
  'm-auto max-h-[calc(100dvh-var(--spacing)*8)] w-[calc(100%-var(--spacing)*8)] overflow-y-auto rounded-lg border border-border-strong bg-surface-200 p-0 text-ink shadow-pop backdrop:bg-scrim',
  {
    variants: {
      size: {
        sm: 'max-w-detail',
        md: 'max-w-dialog',
        lg: 'max-w-dialog-wide',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

interface ModalProps extends VariantProps<typeof modalVariants> {
  isOpen: boolean
  labelledBy: string
  closesOnBackdropClick?: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({
  isOpen,
  labelledBy,
  closesOnBackdropClick = false,
  onClose,
  size,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isOpen) return
    dialog.showModal()
    return () => dialog.close()
  }, [isOpen])

  function handleEscape(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onClose()
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (closesOnBackdropClick && event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onCancel={handleEscape}
      onClick={handleClick}
      className={modalVariants({ size })}
    >
      <div className="p-6">{children}</div>
    </dialog>
  )
}
