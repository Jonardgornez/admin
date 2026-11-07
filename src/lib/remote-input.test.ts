import { describe, expect, it } from 'vitest'
import {
  buildButtonMessage,
  buildControlMessage,
  buildKeyMessage,
  buildMoveMessage,
  buildWheelMessage,
  createMoveCoalescer,
  getDrawnImageRect,
  isReleaseShortcut,
  mapPointerToFrame,
  parseServerControlMessage,
  RELEASE_MESSAGE,
  toRemoteButton,
  toWheelUnits,
} from './remote-input'

const DOM_DELTA_PIXEL = 0
const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2
const FRAME = { width: 200, height: 100 }

describe('getDrawnImageRect', () => {
  it('centres a wide frame vertically when the element is taller (letterbox)', () => {
    expect(getDrawnImageRect({ left: 0, top: 0, width: 100, height: 400 }, FRAME)).toEqual({
      left: 0,
      top: 175,
      width: 100,
      height: 50,
    })
  })

  it('centres the frame horizontally when the element is wider (pillarbox)', () => {
    expect(getDrawnImageRect({ left: 0, top: 0, width: 400, height: 100 }, FRAME)).toEqual({
      left: 100,
      top: 0,
      width: 200,
      height: 100,
    })
  })

  it('returns null when the element or the frame has no size', () => {
    expect(getDrawnImageRect({ left: 0, top: 0, width: 0, height: 100 }, FRAME)).toBeNull()
    expect(getDrawnImageRect({ left: 0, top: 0, width: 100, height: 100 }, { width: 0, height: 0 })).toBeNull()
  })
})

describe('mapPointerToFrame', () => {
  it('maps the corners of a pillarboxed image to 0 and 65535', () => {
    const rect = { left: 10, top: 20, width: 400, height: 100 }
    expect(mapPointerToFrame({ clientX: 110, clientY: 20 }, rect, FRAME)).toEqual({ x: 0, y: 0 })
    expect(mapPointerToFrame({ clientX: 310, clientY: 120 }, rect, FRAME)).toEqual({
      x: 65535,
      y: 65535,
    })
  })

  it('maps the centre of a pillarboxed image to the middle of the frame', () => {
    const rect = { left: 10, top: 20, width: 400, height: 100 }
    expect(mapPointerToFrame({ clientX: 210, clientY: 70 }, rect, FRAME)).toEqual({
      x: 32768,
      y: 32768,
    })
  })

  it('maps the corners of a letterboxed image to 0 and 65535', () => {
    const rect = { left: 0, top: 0, width: 100, height: 400 }
    expect(mapPointerToFrame({ clientX: 0, clientY: 175 }, rect, FRAME)).toEqual({ x: 0, y: 0 })
    expect(mapPointerToFrame({ clientX: 100, clientY: 225 }, rect, FRAME)).toEqual({
      x: 65535,
      y: 65535,
    })
  })

  it('maps the centre of a letterboxed image to the middle of the frame', () => {
    const rect = { left: 0, top: 0, width: 100, height: 400 }
    expect(mapPointerToFrame({ clientX: 50, clientY: 200 }, rect, FRAME)).toEqual({
      x: 32768,
      y: 32768,
    })
  })

  it('returns null for a point in the side bars of a pillarboxed image', () => {
    const rect = { left: 10, top: 20, width: 400, height: 100 }
    expect(mapPointerToFrame({ clientX: 60, clientY: 70 }, rect, FRAME)).toBeNull()
    expect(mapPointerToFrame({ clientX: 350, clientY: 70 }, rect, FRAME)).toBeNull()
  })

  it('returns null for a point in the top and bottom bars of a letterboxed image', () => {
    const rect = { left: 0, top: 0, width: 100, height: 400 }
    expect(mapPointerToFrame({ clientX: 50, clientY: 100 }, rect, FRAME)).toBeNull()
    expect(mapPointerToFrame({ clientX: 50, clientY: 300 }, rect, FRAME)).toBeNull()
  })

  it('clamps a point outside the image when asked to', () => {
    const rect = { left: 10, top: 20, width: 400, height: 100 }
    expect(mapPointerToFrame({ clientX: 0, clientY: 1000 }, rect, FRAME, { clamp: true })).toEqual({
      x: 0,
      y: 65535,
    })
  })

  it('returns null when the frame has no size', () => {
    expect(
      mapPointerToFrame({ clientX: 1, clientY: 1 }, { left: 0, top: 0, width: 10, height: 10 }, {
        width: 0,
        height: 0,
      }),
    ).toBeNull()
  })
})

describe('toRemoteButton', () => {
  it('passes the browser buttons 0 to 4 through', () => {
    expect([0, 1, 2, 3, 4].map(toRemoteButton)).toEqual([0, 1, 2, 3, 4])
  })

  it('rejects other buttons', () => {
    expect(toRemoteButton(-1)).toBeNull()
    expect(toRemoteButton(5)).toBeNull()
    expect(toRemoteButton(1.5)).toBeNull()
  })
})

describe('toWheelUnits', () => {
  it('converts pixels to Windows units at about 120 per 100 pixels', () => {
    expect(toWheelUnits(100, DOM_DELTA_PIXEL)).toBe(120)
    expect(toWheelUnits(-100, DOM_DELTA_PIXEL)).toBe(-120)
  })

  it('converts lines and pages to units', () => {
    expect(toWheelUnits(3, DOM_DELTA_LINE)).toBe(360)
    expect(toWheelUnits(1, DOM_DELTA_PAGE)).toBe(1200)
  })

  it('clamps to plus or minus 1200', () => {
    expect(toWheelUnits(5000, DOM_DELTA_PIXEL)).toBe(1200)
    expect(toWheelUnits(-5000, DOM_DELTA_PIXEL)).toBe(-1200)
  })

  it('rounds tiny deltas to zero without producing negative zero', () => {
    expect(toWheelUnits(0.2, DOM_DELTA_PIXEL)).toBe(0)
    expect(toWheelUnits(-0.2, DOM_DELTA_PIXEL)).toBe(0)
  })
})

describe('buildWheelMessage', () => {
  it('builds a wheel message with the browser sign for dy', () => {
    expect(
      buildWheelMessage({ deltaX: 0, deltaY: 100, deltaMode: DOM_DELTA_PIXEL }),
    ).toBe('{"t":"wheel","dx":0,"dy":120}')
  })

  it('sends nothing when both deltas round to zero', () => {
    expect(buildWheelMessage({ deltaX: 0.1, deltaY: 0.1, deltaMode: DOM_DELTA_PIXEL })).toBeNull()
  })
})

describe('buildKeyMessage', () => {
  it('builds a key down and a key up message from KeyboardEvent.code', () => {
    expect(buildKeyMessage('KeyA', true)).toBe('{"t":"key","c":"KeyA","d":true}')
    expect(buildKeyMessage('Digit1', false)).toBe('{"t":"key","c":"Digit1","d":false}')
  })

  it('accepts codes of 1 to 32 letters and digits', () => {
    expect(buildKeyMessage('a', true)).not.toBeNull()
    expect(buildKeyMessage('a'.repeat(32), true)).not.toBeNull()
  })

  it('rejects empty, too long and non alphanumeric codes', () => {
    expect(buildKeyMessage('', true)).toBeNull()
    expect(buildKeyMessage('a'.repeat(33), true)).toBeNull()
    expect(buildKeyMessage('Key A', true)).toBeNull()
    expect(buildKeyMessage('Key-A', true)).toBeNull()
    expect(buildKeyMessage('Ä', true)).toBeNull()
  })
})

describe('isReleaseShortcut', () => {
  const shortcut = { code: 'KeyX', ctrlKey: true, altKey: true, shiftKey: true }

  it('is true for Ctrl+Alt+Shift+X', () => {
    expect(isReleaseShortcut(shortcut)).toBe(true)
  })

  it('is false when any modifier is missing', () => {
    expect(isReleaseShortcut({ ...shortcut, ctrlKey: false })).toBe(false)
    expect(isReleaseShortcut({ ...shortcut, altKey: false })).toBe(false)
    expect(isReleaseShortcut({ ...shortcut, shiftKey: false })).toBe(false)
  })

  it('is false for another key', () => {
    expect(isReleaseShortcut({ ...shortcut, code: 'KeyY' })).toBe(false)
  })
})

describe('input message builders', () => {
  it('builds move, button, control and release messages in the protocol shape', () => {
    expect(buildMoveMessage({ x: 1, y: 2 })).toBe('{"t":"move","x":1,"y":2}')
    expect(buildButtonMessage('down', 2, { x: 3, y: 4 })).toBe('{"t":"down","b":2,"x":3,"y":4}')
    expect(buildButtonMessage('up', 0, { x: 5, y: 6 })).toBe('{"t":"up","b":0,"x":5,"y":6}')
    expect(buildControlMessage(true)).toBe('{"t":"control","on":true}')
    expect(buildControlMessage(false)).toBe('{"t":"control","on":false}')
    expect(RELEASE_MESSAGE).toBe('{"t":"release"}')
  })
})

describe('parseServerControlMessage', () => {
  it('reads requesting and on', () => {
    expect(parseServerControlMessage('{"control":"requesting"}')).toEqual({ control: 'requesting' })
    expect(parseServerControlMessage('{"control":"on"}')).toEqual({ control: 'on' })
  })

  it('reads every off reason', () => {
    for (const reason of [
      'stopped',
      'anonymous',
      'server-pc',
      'waiting',
      'unsupported',
      'connection',
      'pc-ended',
    ]) {
      expect(parseServerControlMessage(`{"control":"off","reason":"${reason}"}`)).toEqual({
        control: 'off',
        reason,
      })
    }
  })

  it('returns null for an unknown reason or control value', () => {
    expect(parseServerControlMessage('{"control":"off","reason":"sideways"}')).toBeNull()
    expect(parseServerControlMessage('{"control":"maybe"}')).toBeNull()
  })

  it('returns null for an off message without a reason', () => {
    expect(parseServerControlMessage('{"control":"off"}')).toBeNull()
  })

  it('returns null for text that is not JSON or is a state message', () => {
    expect(parseServerControlMessage('on')).toBeNull()
    expect(parseServerControlMessage('{"state":"live"}')).toBeNull()
  })
})

describe('createMoveCoalescer', () => {
  function createFakeScheduler() {
    const callbacks = new Map<number, () => void>()
    let nextId = 1
    return {
      requestFrame: (callback: () => void) => {
        const id = nextId++
        callbacks.set(id, callback)
        return id
      },
      cancelFrame: (frameId: number) => {
        callbacks.delete(frameId)
      },
      runFrame: () => {
        const pending = [...callbacks.values()]
        callbacks.clear()
        pending.forEach((callback) => callback())
      },
      pendingFrameCount: () => callbacks.size,
    }
  }

  function createRecorder() {
    const scheduler = createFakeScheduler()
    const sent: { x: number; y: number }[] = []
    const coalescer = createMoveCoalescer({
      send: (point) => sent.push(point),
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
    })
    return { coalescer, sent, scheduler }
  }

  it('sends only the latest point on the next frame', () => {
    const { coalescer, sent, scheduler } = createRecorder()
    coalescer.push({ x: 1, y: 1 })
    coalescer.push({ x: 2, y: 2 })
    coalescer.push({ x: 3, y: 3 })
    expect(sent).toEqual([])
    scheduler.runFrame()
    expect(sent).toEqual([{ x: 3, y: 3 }])
  })

  it('keeps at most one frame requested while one is pending', () => {
    const { coalescer, scheduler } = createRecorder()
    coalescer.push({ x: 1, y: 1 })
    coalescer.push({ x: 2, y: 2 })
    expect(scheduler.pendingFrameCount()).toBe(1)
  })

  it('flush sends the pending point at once and cancels the frame', () => {
    const { coalescer, sent, scheduler } = createRecorder()
    coalescer.push({ x: 4, y: 4 })
    coalescer.flush()
    expect(sent).toEqual([{ x: 4, y: 4 }])
    expect(scheduler.pendingFrameCount()).toBe(0)
  })

  it('flush sends nothing when no point is pending', () => {
    const { coalescer, sent } = createRecorder()
    coalescer.flush()
    expect(sent).toEqual([])
  })

  it('cancel drops the pending point', () => {
    const { coalescer, sent, scheduler } = createRecorder()
    coalescer.push({ x: 5, y: 5 })
    coalescer.cancel()
    scheduler.runFrame()
    expect(sent).toEqual([])
  })

  it('schedules a new frame after the previous one ran', () => {
    const { coalescer, sent, scheduler } = createRecorder()
    coalescer.push({ x: 1, y: 1 })
    scheduler.runFrame()
    coalescer.push({ x: 2, y: 2 })
    scheduler.runFrame()
    expect(sent).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
  })
})
