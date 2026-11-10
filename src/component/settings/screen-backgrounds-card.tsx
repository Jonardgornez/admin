import { BACKGROUND_KINDS, BACKGROUNDS_SYNC_NOTE } from '../../lib/backgrounds'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { BackgroundSlot } from './background-slot'
import { SettingsCard } from './settings-card'
import { useScreenBackgrounds } from './use-screen-backgrounds'

export function ScreenBackgroundsCard() {
  const { loadState, retry, busyActions, saveBackground, deleteBackground } =
    useScreenBackgrounds()

  return (
    <SettingsCard title="Screen backgrounds">
      {loadState.status === 'loading' && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading screen backgrounds...
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner
            variant="danger"
            icon="alert"
            title="Can't load screen backgrounds"
            role="alert"
            className="w-full"
          >
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={retry}>
            <Icon name="refresh" />
            Retry
          </Button>
        </div>
      )}
      {loadState.status === 'loaded' && (
        <div className="flex flex-col gap-5">
          {BACKGROUND_KINDS.map((kind) => (
            <BackgroundSlot
              key={kind}
              kind={kind}
              info={loadState.backgrounds[kind]}
              busyAction={busyActions[kind]}
              onSave={(file) => saveBackground(kind, file)}
              onDelete={() => deleteBackground(kind)}
            />
          ))}
        </div>
      )}
      <p className="m-0 text-xs text-ink-muted">{BACKGROUNDS_SYNC_NOTE}</p>
    </SettingsCard>
  )
}
