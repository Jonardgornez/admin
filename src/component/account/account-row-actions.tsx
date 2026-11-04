import type { Account } from '../../types'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

interface AccountRowActionsProps {
  account: Account
  onToggleEnabled: () => void
  onDelete: () => void
}

export function AccountRowActions({ account, onToggleEnabled, onDelete }: AccountRowActionsProps) {
  const deleteLabel = `Delete ${account.username}`

  return (
    <span className="inline-flex justify-end gap-1">
      <Button variant="ghost" size="sm">
        Edit
      </Button>
      <Button variant="ghost" size="sm">
        Reset password
      </Button>
      <Button variant="ghost" size="sm" onClick={onToggleEnabled}>
        {account.isActive ? 'Disable' : 'Enable'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        title={deleteLabel}
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        <Icon name="x" />
      </Button>
    </span>
  )
}
