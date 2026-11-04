import { useId, type ReactNode } from 'react'
import { Button } from './button'
import { Modal } from './modal'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  confirmVariant?: 'primary' | 'danger'
  isConfirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  confirmVariant = 'danger',
  isConfirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()

  return (
    <Modal isOpen={isOpen} labelledBy={titleId} onClose={onCancel}>
      <h2 id={titleId} className="m-0 mb-2 text-xl font-semibold">
        {title}
      </h2>
      <div className="mb-6 text-base text-ink-muted">{children}</div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={confirmVariant} disabled={isConfirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
