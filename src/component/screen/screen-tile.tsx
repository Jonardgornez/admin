import { Link } from 'react-router'
import { getScreenHref } from '../../lib/pcs'
import {
  getScreenTileName,
  TILE_ELSEWHERE_RETRY_MS,
  VIEWED_ELSEWHERE_TEXT,
} from '../../lib/screen-grid'
import { getScreenPlaceholderText } from '../../lib/screen-stream'
import type { ViewMode } from '../../types'
import { ScreenStatusBadge } from '../pc/screen-status-badge'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useScreenTile } from './use-screen-tile'

const tileClassName = 'flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-200 p-2'
const pictureClassName =
  'flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-surface-300 text-center text-sm text-ink-subtle'

interface ScreenTileProps {
  pcId: number
  pcName: string
  mode: ViewMode
}

export function ScreenTile({ pcId, pcName, mode }: ScreenTileProps) {
  const { tileRef, canvasRef, status, isViewedElsewhere, isFrameVisible, reconnect, takeOver } =
    useScreenTile({ pcId, mode })
  const errorText = !isViewedElsewhere && status.kind === 'ended' ? status.message : null
  const placeholderText = isViewedElsewhere
    ? VIEWED_ELSEWHERE_TEXT
    : getScreenPlaceholderText(status)

  return (
    <li ref={tileRef} className={tileClassName}>
      <Link
        to={getScreenHref(pcId, mode)}
        aria-label={getScreenTileName(pcName, status, isViewedElsewhere)}
        className="flex flex-col gap-2 rounded-md text-ink no-underline hover:bg-surface-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 items-center justify-between gap-2 px-1 pt-1">
          <span className="truncate font-mono font-semibold">{pcName}</span>
          <ScreenStatusBadge status={status} />
        </span>
        <span className={pictureClassName}>
          {/* Kept mounted, so the last frame survives a placeholder. Letterboxed by object-contain. */}
          <canvas
            ref={canvasRef}
            hidden={!isFrameVisible}
            className="size-full object-contain"
          />
          {!isFrameVisible && <span className="p-2">{placeholderText}</span>}
        </span>
      </Link>
      {isViewedElsewhere && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 text-sm">
          <p className="m-0 min-w-0 text-ink-muted">Checks again every {TILE_ELSEWHERE_RETRY_MS / 1000} seconds.</p>
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Take over ${pcName}`}
            title="Opens this tile as a full view, which ends the other view of this PC."
            onClick={takeOver}
          >
            <Icon name="eye" />
            Take over
          </Button>
        </div>
      )}
      {errorText && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 text-sm">
          <p className="m-0 min-w-0 text-ink-muted">{errorText}</p>
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Reconnect ${pcName}`}
            onClick={reconnect}
          >
            <Icon name="refresh" />
            Reconnect
          </Button>
        </div>
      )}
    </li>
  )
}

interface OfflineScreenTileProps {
  pcName: string
}

export function OfflineScreenTile({ pcName }: OfflineScreenTileProps) {
  return (
    <li className={tileClassName}>
      <span className="flex min-w-0 items-center justify-between gap-2 px-1 pt-1">
        <span className="truncate font-mono font-semibold">{pcName}</span>
        <Badge variant="offline" icon="power">
          Offline
        </Badge>
      </span>
      <span className={pictureClassName}>Offline</span>
    </li>
  )
}
