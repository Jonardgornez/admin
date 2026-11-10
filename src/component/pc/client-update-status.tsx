import { getClientUpdateLabel } from '../../lib/client-updates'
import type { ClientUpdateState, ClientUpdateStatus } from '../../types'
import { Badge, type BadgeVariant } from '../ui/badge'
import type { IconName } from '../ui/icon'

interface ClientUpdateDisplay {
  variant: BadgeVariant
  icon: IconName
}

const UPDATE_DISPLAY: Record<ClientUpdateState, ClientUpdateDisplay> = {
  pending: { variant: 'update-pending', icon: 'clock' },
  downloading: { variant: 'update-busy', icon: 'download' },
  installing: { variant: 'update-busy', icon: 'hourglass' },
  failed: { variant: 'update-failed', icon: 'alert' },
}

interface ClientUpdateStatusProps {
  clientUpdate: ClientUpdateStatus | null | undefined
}

// Renders inside the card's badge row. A failure shows its reason as visible text, and in the tooltip.
export function ClientUpdateStatusBadge({ clientUpdate }: ClientUpdateStatusProps) {
  if (!clientUpdate) return null
  const { variant, icon } = UPDATE_DISPLAY[clientUpdate.state]
  const isFailed = clientUpdate.state === 'failed'
  const failureReason = clientUpdate.error ?? 'The PC did not say why the update failed.'

  return (
    <>
      <Badge variant={variant} icon={icon} title={isFailed ? failureReason : undefined}>
        {getClientUpdateLabel(clientUpdate)}
      </Badge>
      {isFailed && (
        <p title={failureReason} className="m-0 line-clamp-2 w-full break-words text-xs text-danger">
          {failureReason}
        </p>
      )}
    </>
  )
}
