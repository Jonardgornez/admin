import type { Pc, ViewMode } from '../types'
import { canViewPcScreen } from './pcs'
import type { ScreenStreamStatus } from './screen-stream'

export const TILE_SIZES = ['small', 'medium', 'large'] as const
export type TileSize = (typeof TILE_SIZES)[number]

export const DEFAULT_TILE_SIZE: TileSize = 'small'

export const TILE_SIZE_LABELS: Record<TileSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

// Each tile acks a frame no sooner than this after it arrived, so a PC sends about one frame a second.
export const TILE_ACK_DELAY_MS = 1000

// The mode named in the address, or null when it names none, so the saved default applies.
export function parseViewModeParam(param: string | null): ViewMode | null {
  return param === 'notified' || param === 'anonymous' ? param : null
}

export function parseTileSizeParam(param: string | null): TileSize {
  return TILE_SIZES.find((size) => size === param) ?? DEFAULT_TILE_SIZE
}

// Viewable PCs first, each group in the server's order, which is the dashboard's name order.
export function orderScreenGridPcs<T extends Pc>(pcs: T[], isOfflineShown: boolean): T[] {
  const viewable = pcs.filter(canViewPcScreen)
  if (!isOfflineShown) return viewable
  return [...viewable, ...pcs.filter((pc) => !canViewPcScreen(pc))]
}

export function countViewablePcs(pcs: Pc[]): number {
  return pcs.filter(canViewPcScreen).length
}

const TILE_STATUS_TEXTS: Record<ScreenStreamStatus['kind'], string> = {
  idle: 'connecting',
  connecting: 'connecting',
  waiting: 'waiting for the PC',
  live: 'live',
  secure: 'PC reports a protected screen',
  paused: 'paused',
  ended: 'ended',
}

export const VIEWED_ELSEWHERE_TEXT = 'Open in full view elsewhere'

// How often a tile whose PC is viewed elsewhere checks again whether it is free.
export const TILE_ELSEWHERE_RETRY_MS = 10_000

// The tile's accessible name, such as "PC-3 screen, live".
export function getScreenTileName(
  pcName: string,
  status: ScreenStreamStatus,
  isViewedElsewhere: boolean,
): string {
  const statusText = isViewedElsewhere
    ? VIEWED_ELSEWHERE_TEXT.toLowerCase()
    : TILE_STATUS_TEXTS[status.kind]
  return `${pcName} screen, ${statusText}`
}
