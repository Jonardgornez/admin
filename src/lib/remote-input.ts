import { z } from 'zod'

export type RemoteMouseButton = 0 | 1 | 2 | 3 | 4

export type ButtonAction = 'down' | 'up'

export const CONTROL_OFF_REASONS = [
  'stopped',
  'anonymous',
  'server-pc',
  'waiting',
  'unsupported',
  'connection',
  'pc-ended',
] as const

export type ControlOffReason = (typeof CONTROL_OFF_REASONS)[number]

export interface ElementRect {
  left: number
  top: number
  width: number
  height: number
}

export interface FrameSize {
  width: number
  height: number
}

export interface PointerPosition {
  clientX: number
  clientY: number
}

export interface FramePoint {
  x: number
  y: number
}

export interface DrawnImageRect {
  left: number
  top: number
  width: number
  height: number
}

export interface WheelDeltas {
  deltaX: number
  deltaY: number
  deltaMode: number
}

// Wheel amounts in Windows units. They are not rounded, so small deltas add up within a frame.
export interface WheelUnits {
  dx: number
  dy: number
}

export interface ShortcutKeyEvent {
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export const FRAME_COORDINATE_MAX = 65535

// PointerEvent.buttons bits, mapped to the protocol's MouseEvent.button values.
const BUTTON_BITS: readonly { bit: number; button: RemoteMouseButton }[] = [
  { bit: 1, button: 0 },
  { bit: 2, button: 2 },
  { bit: 4, button: 1 },
  { bit: 8, button: 3 },
  { bit: 16, button: 4 },
]
const WHEEL_UNIT = 120
const WHEEL_MAX_UNITS = 1200
const PIXEL_TO_WHEEL_UNITS = WHEEL_UNIT / 100
const LINE_TO_WHEEL_UNITS = WHEEL_UNIT
const PAGE_TO_WHEEL_UNITS = WHEEL_MAX_UNITS
const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2
const KEY_CODE_PATTERN = /^[A-Za-z0-9]{1,32}$/
const RELEASE_SHORTCUT_CODE = 'KeyX'

export const RELEASE_MESSAGE = JSON.stringify({ t: 'release' })
// Ctrl+Alt+Del on the PC. The server relays it only while control is on, at most once a second.
export const SECURE_ATTENTION_MESSAGE = JSON.stringify({ t: 'sas' })

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// The image is drawn centred inside the element with object-contain, so bars sit on the sides
// (pillarbox) or above and below (letterbox).
export function getDrawnImageRect(rect: ElementRect, frame: FrameSize): DrawnImageRect | null {
  if (rect.width <= 0 || rect.height <= 0 || frame.width <= 0 || frame.height <= 0) return null
  const scale = Math.min(rect.width / frame.width, rect.height / frame.height)
  const width = frame.width * scale
  const height = frame.height * scale
  return { left: (rect.width - width) / 2, top: (rect.height - height) / 2, width, height }
}

function toFrameCoordinate(offset: number, size: number): number {
  const ratio = clamp(offset / size, 0, 1)
  return Math.round(ratio * FRAME_COORDINATE_MAX)
}

// Returns null outside the drawn image unless clamp is set. Releasing a button uses clamp so the
// PC never keeps a button held because the pointer ended in a bar.
export function mapPointerToFrame(
  pointer: PointerPosition,
  rect: ElementRect,
  frame: FrameSize,
  options: { clamp?: boolean } = {},
): FramePoint | null {
  const drawn = getDrawnImageRect(rect, frame)
  if (!drawn) return null
  const offsetX = pointer.clientX - rect.left - drawn.left
  const offsetY = pointer.clientY - rect.top - drawn.top
  const isInside =
    offsetX >= 0 && offsetX <= drawn.width && offsetY >= 0 && offsetY <= drawn.height
  if (!isInside && !options.clamp) return null
  return {
    x: toFrameCoordinate(offsetX, drawn.width),
    y: toFrameCoordinate(offsetY, drawn.height),
  }
}

// The buttons held in a PointerEvent.buttons bitmask, as protocol button values.
export function getPressedButtons(buttonsBitmask: number): RemoteMouseButton[] {
  return BUTTON_BITS.filter(({ bit }) => (buttonsBitmask & bit) !== 0).map(({ button }) => button)
}

function getWheelUnitsPerDelta(deltaMode: number): number {
  if (deltaMode === DOM_DELTA_PAGE) return PAGE_TO_WHEEL_UNITS
  if (deltaMode === DOM_DELTA_LINE) return LINE_TO_WHEEL_UNITS
  return PIXEL_TO_WHEEL_UNITS
}

// Browser deltas keep their sign (positive is down), which is what the protocol expects.
export function toWheelUnits(deltas: WheelDeltas): WheelUnits {
  const unitsPerDelta = getWheelUnitsPerDelta(deltas.deltaMode)
  return { dx: deltas.deltaX * unitsPerDelta, dy: deltas.deltaY * unitsPerDelta }
}

export function mergeWheelUnits(pending: WheelUnits | null, next: WheelUnits): WheelUnits {
  return { dx: (pending?.dx ?? 0) + next.dx, dy: (pending?.dy ?? 0) + next.dy }
}

function toClampedWheelUnit(units: number): number {
  return clamp(Math.round(units) || 0, -WHEEL_MAX_UNITS, WHEEL_MAX_UNITS)
}

export function buildWheelMessage(units: WheelUnits): string | null {
  const dx = toClampedWheelUnit(units.dx)
  const dy = toClampedWheelUnit(units.dy)
  if (dx === 0 && dy === 0) return null
  return JSON.stringify({ t: 'wheel', dx, dy })
}

// Only KeyboardEvent.code values of letters and digits are sent, so the server can trust the shape.
export function buildKeyMessage(code: string, isDown: boolean): string | null {
  if (!KEY_CODE_PATTERN.test(code)) return null
  return JSON.stringify({ t: 'key', c: code, d: isDown })
}

// The shortcut is handled in the browser and never sent to the PC.
export function isReleaseShortcut(event: ShortcutKeyEvent): boolean {
  return (
    event.code === RELEASE_SHORTCUT_CODE && event.ctrlKey && event.altKey && event.shiftKey
  )
}

export function buildControlMessage(isOn: boolean): string {
  return JSON.stringify({ t: 'control', on: isOn })
}

export function buildMoveMessage(point: FramePoint): string {
  return JSON.stringify({ t: 'move', x: point.x, y: point.y })
}

export function buildButtonMessage(
  action: ButtonAction,
  button: RemoteMouseButton,
  point: FramePoint,
): string {
  return JSON.stringify({ t: action, b: button, x: point.x, y: point.y })
}

const serverControlMessageSchema = z.discriminatedUnion('control', [
  z.object({ control: z.literal('requesting') }),
  z.object({ control: z.literal('on') }),
  z.object({ control: z.literal('off'), reason: z.enum(CONTROL_OFF_REASONS) }),
])

export type ServerControlMessage = z.infer<typeof serverControlMessageSchema>

export function parseServerControlMessage(text: string): ServerControlMessage | null {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  const result = serverControlMessageSchema.safeParse(body)
  return result.success ? result.data : null
}

export function keepLatest<Item>(_pending: Item | null, next: Item): Item {
  return next
}

export interface FrameCoalescer<Item> {
  push: (item: Item) => void
  // Sends the pending item now, so an input message that follows is never overtaken by it.
  flush: () => void
  cancel: () => void
}

interface FrameCoalescerOptions<Item> {
  // Combines an item with the one still pending, for example by keeping the latest or summing.
  merge: (pending: Item | null, next: Item) => Item
  send: (item: Item) => void
  requestFrame: (callback: () => void) => number
  cancelFrame: (frameId: number) => void
}

// Holds merged input and sends it at most once per animation frame.
export function createFrameCoalescer<Item>({
  merge,
  send,
  requestFrame,
  cancelFrame,
}: FrameCoalescerOptions<Item>): FrameCoalescer<Item> {
  let pending: Item | null = null
  let frameId: number | null = null

  function sendPending() {
    const item = pending
    pending = null
    if (item !== null) send(item)
  }

  function cancelScheduledFrame() {
    if (frameId !== null) cancelFrame(frameId)
    frameId = null
  }

  return {
    push(item) {
      pending = merge(pending, item)
      if (frameId === null) {
        frameId = requestFrame(() => {
          frameId = null
          sendPending()
        })
      }
    },
    flush() {
      cancelScheduledFrame()
      sendPending()
    },
    cancel() {
      cancelScheduledFrame()
      pending = null
    },
  }
}
