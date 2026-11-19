import { useSearchParams } from 'react-router'
import { PageHeader } from '../component/layout/page-header'
import { ScreenGrid } from '../component/screen/screen-grid'
import { usePcs } from '../component/pc/use-pcs'
import { useConsoleDefaults } from '../component/settings/use-console-defaults'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Checkbox, RadioOption } from '../component/ui/choice'
import { Icon } from '../component/ui/icon'
import {
  countViewablePcs,
  parseTileSizeParam,
  parseViewModeParam,
  TILE_SIZE_LABELS,
  TILE_SIZES,
} from '../lib/screen-grid'

const MODE_PARAM = 'mode'
const SIZE_PARAM = 'size'
const OFFLINE_PARAM = 'offline'
const OFFLINE_SHOWN_VALUE = 'shown'

const legendClassName = 'p-0 pb-1 text-xs font-semibold tracking-label text-ink-muted'
const fieldsetClassName = 'm-0 flex flex-wrap items-center gap-x-4 gap-y-2 border-0 p-0'

export function ScreensPage() {
  const { pcs, loadState, isDisconnected, retry } = usePcs()
  const consoleDefaults = useConsoleDefaults()
  const [searchParams, setSearchParams] = useSearchParams()
  // The address wins. Otherwise the saved default, which falls back to notified if it can't load.
  // Null until it is known, so no tile opens in the wrong mode.
  const mode =
    parseViewModeParam(searchParams.get(MODE_PARAM)) ??
    (consoleDefaults.isLoaded ? consoleDefaults.defaults.defaultViewMode : null)
  const isLoading = loadState.status === 'loading' || (loadState.status === 'loaded' && mode === null)
  const size = parseTileSizeParam(searchParams.get(SIZE_PARAM))
  const isOfflineShown = searchParams.get(OFFLINE_PARAM) === OFFLINE_SHOWN_VALUE

  // Kept in the address, so a reload or a shared link opens the same view.
  function updateParam(name: string, value: string | null) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === null) next.delete(name)
        else next.set(name, value)
        return next
      },
      { replace: true },
    )
  }

  return (
    <>
      <PageHeader
        title="Screens"
        meta={
          loadState.status === 'loaded' && (
            <span className="text-ink-muted">{countViewablePcs(pcs)} online</span>
          )
        }
      >
        {isDisconnected && (
          <Button variant="secondary" onClick={retry}>
            <Icon name="refresh" />
            Retry now
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded-lg border border-border bg-surface-200 p-4">
        <fieldset className={fieldsetClassName}>
          <legend className={legendClassName}>View mode</legend>
          <RadioOption
            name="screens-mode"
            value="notified"
            checked={mode === 'notified'}
            onChange={() => updateParam(MODE_PARAM, 'notified')}
          >
            Notified – the user sees a notice
          </RadioOption>
          <RadioOption
            name="screens-mode"
            value="anonymous"
            checked={mode === 'anonymous'}
            onChange={() => updateParam(MODE_PARAM, 'anonymous')}
          >
            Anonymous – no sign on the PC
          </RadioOption>
        </fieldset>
        <fieldset className={fieldsetClassName}>
          <legend className={legendClassName}>Tile size</legend>
          {TILE_SIZES.map((tileSize) => (
            <RadioOption
              key={tileSize}
              name="screens-size"
              value={tileSize}
              checked={size === tileSize}
              onChange={() => updateParam(SIZE_PARAM, tileSize)}
            >
              {TILE_SIZE_LABELS[tileSize]}
            </RadioOption>
          ))}
        </fieldset>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={isOfflineShown}
            onChange={(event) =>
              updateParam(OFFLINE_PARAM, event.target.checked ? OFFLINE_SHOWN_VALUE : null)
            }
          />
          Show offline PCs
        </label>
      </div>

      {isDisconnected && (
        <Banner variant="danger" icon="alert" role="alert" title="Disconnected">
          The console lost its connection to the server. The PC list may be out of date.
          Reconnecting automatically…
        </Banner>
      )}

      {isLoading && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading PCs...
        </p>
      )}

      {loadState.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Banner variant="danger" icon="alert" role="alert" title="Can't load PCs" className="w-full">
            {loadState.error}
          </Banner>
          <Button variant="secondary" onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      {loadState.status === 'loaded' && mode !== null && (
        <ScreenGrid
          pcs={pcs}
          mode={mode}
          size={size}
          isOfflineShown={isOfflineShown}
          emptyMessage={pcs.length === 0 ? 'No PCs are registered yet.' : 'No PCs are online.'}
        />
      )}
    </>
  )
}
