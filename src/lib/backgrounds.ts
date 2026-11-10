export const BACKGROUND_KINDS = ['login', 'lock'] as const

export type BackgroundKind = (typeof BACKGROUND_KINDS)[number]

interface BackgroundCopy {
  title: string
  hint: string
}

export const BACKGROUND_COPY: Record<BackgroundKind, BackgroundCopy> = {
  login: {
    title: 'Login screen',
    hint: 'Shown behind the sign-in card on every lab PC.',
  },
  lock: {
    title: 'Lock screen',
    hint: 'Shown behind the lock message when you lock a PC.',
  },
}

export const NO_BACKGROUND_TEXT = 'No image — PCs show the plain background.'
export const BACKGROUND_FORMAT_NOTE = 'PNG or JPEG, up to 5 MB and 7680 × 4320 pixels.'
export const BACKGROUNDS_SYNC_NOTE = 'PCs pick up changes within a few seconds while they are online.'

const BYTES_PER_KB = 1024
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB

export function formatBackgroundSize(sizeBytes: number): string {
  if (sizeBytes < BYTES_PER_MB) return `${Math.max(1, Math.round(sizeBytes / BYTES_PER_KB))} KB`
  return `${(sizeBytes / BYTES_PER_MB).toFixed(1)} MB`
}

const UPDATED_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
}

export function formatBackgroundUpdated(updatedAtUtc: string): string {
  const updated = new Date(updatedAtUtc).toLocaleString(undefined, UPDATED_FORMAT_OPTIONS)
  return `Updated ${updated}`
}
