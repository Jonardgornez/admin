import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

interface ScreenEndedBannerProps {
  message: string
  canReconnect: boolean
  onReconnect: () => void
}

export function ScreenEndedBanner({ message, canReconnect, onReconnect }: ScreenEndedBannerProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Banner variant="danger" icon="alert" role="alert" title="Screen view ended" className="w-full">
        {message}
      </Banner>
      {canReconnect && (
        <Button variant="secondary" onClick={onReconnect}>
          <Icon name="refresh" />
          Reconnect
        </Button>
      )}
    </div>
  )
}
