import { z } from 'zod'
import type { ViewMode } from '../types'

const viewModeSchema = z.enum(['notified', 'anonymous'])

const serverScreenStateMessageSchema = z.object({
  state: z.enum(['waiting', 'live', 'paused']),
})

export type ServerScreenState = z.infer<typeof serverScreenStateMessageSchema>['state']

export type ScreenStreamStatus =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'waiting' }
  | { kind: 'live' }
  | { kind: 'paused' }
  | { kind: 'ended'; message: string }

export interface ScreenSize {
  width: number
  height: number
}

export interface ScreenStreamLocation {
  protocol: string
  host: string
}

export const PC_GONE_MESSAGE = 'This PC went offline or was removed, so the screen view ended.'
export const SCREEN_REFUSED_MESSAGE =
  "Couldn't open the screen. The PC may be offline, or your session may have ended."
export const PAUSED_MESSAGE =
  'The PC is showing a protected screen, such as a Windows security prompt.'

const SESSION_ENDED_MESSAGE = 'Your session ended. Sign in again.'
const NORMAL_CLOSE_CODE = 1000
const SERVER_STOPPING_CLOSE_CODE = 1001
const ABNORMAL_CLOSE_CODE = 1006
const BROWSER_BEHIND_CLOSE_CODE = 1008
const REPLACED_CLOSE_CODE = 4001
const PC_GONE_CLOSE_CODE = 4002
const SESSION_ENDED_CLOSE_CODE = 4003

const RETRYABLE_CLOSE_CODES = new Set([
  SERVER_STOPPING_CLOSE_CODE,
  ABNORMAL_CLOSE_CODE,
  BROWSER_BEHIND_CLOSE_CODE,
])
const RETRY_BASE_DELAY_MS = 1000
const RETRY_MAX_ATTEMPTS = 4

const FORBIDDEN_FILENAME_CHARACTERS = /[\\/:*?"<>|]/g

interface ScreenCloseOutcome {
  message: string
  canRetry: boolean
  isSessionEnded: boolean
}

export function buildScreenStreamUrl(
  location: ScreenStreamLocation,
  pcId: number,
  mode: ViewMode,
): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  const validMode = viewModeSchema.parse(mode)
  const pcPath = encodeURIComponent(String(pcId))
  return `${scheme}://${location.host}/api/pcs/${pcPath}/screen/live?mode=${validMode}`
}

export function parseScreenStateMessage(text: string): ServerScreenState | null {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  const result = serverScreenStateMessageSchema.safeParse(body)
  return result.success ? result.data.state : null
}

function getCloseMessage(code: number): string {
  switch (code) {
    case NORMAL_CLOSE_CODE:
      return 'The screen view ended.'
    case SERVER_STOPPING_CLOSE_CODE:
      return 'The server stopped, so the screen view ended.'
    case ABNORMAL_CLOSE_CODE:
      return 'The connection to the server was lost.'
    case BROWSER_BEHIND_CLOSE_CODE:
      return 'This browser fell behind the screen updates, so the view stopped.'
    case REPLACED_CLOSE_CODE:
      return 'Another admin started viewing this PC, so this view was replaced.'
    case PC_GONE_CLOSE_CODE:
      return PC_GONE_MESSAGE
    default:
      return 'The screen view ended unexpectedly.'
  }
}

// Only closes that look like a network or server hiccup are retried. Replacement, offline and
// session-ended closes are final.
export function describeScreenClose(code: number): ScreenCloseOutcome {
  if (code === SESSION_ENDED_CLOSE_CODE) {
    return { message: SESSION_ENDED_MESSAGE, canRetry: false, isSessionEnded: true }
  }
  return {
    message: getCloseMessage(code),
    canRetry: RETRYABLE_CLOSE_CODES.has(code),
    isSessionEnded: false,
  }
}

// Returns the wait before the given automatic retry (1-based), or null once retries are used up.
export function getScreenRetryDelayMs(retryNumber: number): number | null {
  if (retryNumber < 1 || retryNumber > RETRY_MAX_ATTEMPTS) return null
  return RETRY_BASE_DELAY_MS * 2 ** (retryNumber - 1)
}

export function isActiveScreenStatus(status: ScreenStreamStatus): boolean {
  return (
    status.kind === 'connecting' ||
    status.kind === 'waiting' ||
    status.kind === 'live' ||
    status.kind === 'paused'
  )
}

const STATUS_LABELS: Record<ScreenStreamStatus['kind'], string> = {
  idle: 'Connecting',
  connecting: 'Connecting',
  waiting: 'Waiting for the PC',
  live: 'Live',
  paused: 'Paused',
  ended: 'Ended',
}

export function getScreenStatusLabel(status: ScreenStreamStatus): string {
  return STATUS_LABELS[status.kind]
}

const PLACEHOLDER_TEXTS: Record<ScreenStreamStatus['kind'], string> = {
  idle: 'Connecting to the screen...',
  connecting: 'Connecting to the screen...',
  waiting: 'Waiting for the PC to send its screen...',
  live: 'Waiting for the first picture...',
  paused: PAUSED_MESSAGE,
  ended: 'No picture. Reconnect to see the screen again.',
}

export function getScreenPlaceholderText(status: ScreenStreamStatus): string {
  return PLACEHOLDER_TEXTS[status.kind]
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatLocalTimestamp(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${day}-${time}`
}

export function buildScreenshotFilename(pcName: string, now: Date): string {
  const safeName = pcName.replace(FORBIDDEN_FILENAME_CHARACTERS, '_')
  return `${safeName}-${formatLocalTimestamp(now)}.png`
}

// Keeps at most one waiting frame while one is being drawn. Every frame that is replaced or
// drawn is reported through its callbacks exactly once, so the server's ack flow never stalls.
export class LatestFrameQueue<Frame> {
  private isBusy = false
  private pending: Frame | null = null
  private readonly drawFrame: (frame: Frame) => Promise<void>
  private readonly dropFrame: (frame: Frame) => void

  constructor(drawFrame: (frame: Frame) => Promise<void>, dropFrame: (frame: Frame) => void) {
    this.drawFrame = drawFrame
    this.dropFrame = dropFrame
  }

  push(frame: Frame): void {
    if (!this.isBusy) {
      void this.run(frame)
      return
    }
    if (this.pending !== null) this.dropFrame(this.pending)
    this.pending = frame
  }

  private async run(first: Frame): Promise<void> {
    this.isBusy = true
    try {
      let next: Frame | null = first
      while (next !== null) {
        await this.drawFrame(next)
        next = this.pending
        this.pending = null
      }
    } finally {
      this.isBusy = false
    }
  }
}
