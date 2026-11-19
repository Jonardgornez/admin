import { z } from 'zod'

export const REMOTE_CURSOR_NAMES = [
  'default',
  'text',
  'wait',
  'progress',
  'crosshair',
  'pointer',
  'help',
  'not-allowed',
  'move',
  'ns-resize',
  'ew-resize',
  'nwse-resize',
  'nesw-resize',
  'col-resize',
  'row-resize',
  'none',
] as const

const CURSOR_HOTSPOT_MAX = 63
const CURSOR_PNG_MAX_LENGTH = 22_000
// Standard base64 only, so nothing but image data can end up inside the data URL.
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

const hotspotSchema = z.number().int().min(0).max(CURSOR_HOTSPOT_MAX)

const serverCursorMessageSchema = z.union([
  z.strictObject({ cursor: z.enum(REMOTE_CURSOR_NAMES) }),
  z.strictObject({
    cursor: z.literal('image'),
    x: hotspotSchema,
    y: hotspotSchema,
    png: z.string().max(CURSOR_PNG_MAX_LENGTH).regex(BASE64_PATTERN),
  }),
])

export type ServerCursorMessage = z.infer<typeof serverCursorMessageSchema>

export function parseServerCursorMessage(text: string): ServerCursorMessage | null {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  const result = serverCursorMessageSchema.safeParse(body)
  return result.success ? result.data : null
}

// The CSS cursor that mirrors the PC's pointer. A custom image falls back to the arrow.
export function cursorToCss(message: ServerCursorMessage): string {
  if (message.cursor !== 'image') return message.cursor
  return `url("data:image/png;base64,${message.png}") ${message.x} ${message.y}, default`
}
