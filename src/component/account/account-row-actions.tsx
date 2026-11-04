import type { Account } from '../../types'
import { Button } from '../ui/button'

interface AccountRowActionsProps {
  account: Account
  onEdit: () => void
  onToggleEnabled: () => void
  onDelete: () => void
}

export function AccountRowActions({ account, onEdit, onToggleEnabled, onDelete }: AccountRowActionsProps) {
  return (
    <span className="inline-flex justify-end gap-1">
      <Button variant="ghost" size="sm" aria-label={`Edit ${account.username}`} onClick={onEdit}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" onClick={onToggleEnabled}>
        {account.isActive ? 'Disable' : 'Enable'}
      </Button>
      <Button variant="ghost" size="sm" aria-label={`Delete ${account.username}`} onClick={onDelete}>
        Delete
      </Button>
    </span>
  )
}
