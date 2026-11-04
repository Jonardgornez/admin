import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react'
import { Button } from './button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  function handleEscape(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={handleEscape}
      className="m-auto w-[calc(100%-var(--spacing)*8)] max-w-dialog rounded-lg border border-border-strong bg-surface-200 p-6 text-ink shadow-pop backdrop:bg-scrim"
    >
      <h2 id={titleId} className="m-0 mb-2 text-xl font-semibold">
        {title}
      </h2>
      <div className="mb-6 text-base text-ink-muted">{children}</div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
