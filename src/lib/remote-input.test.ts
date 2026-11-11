import { describe, expect, it } from 'vitest'
import {
  buildButtonMessage,
  buildControlMessage,
  buildKeyMessage,
  buildMoveMessage,
  buildWheelMessage,
  createFrameCoalescer,
  getDrawnImageRect,
  getPressedButtons,
  isReleaseShortcut,
  keepLatest,
  mapPointerToFrame,
  mergeWheelUnits,
  parseServerControlMessage,
  RELEASE_MESSAGE,
  SECURE_ATTENTION_MESSAGE,
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
    expect(
      getDrawnImageRect({ left: 0, top: 0, width: 100, height: 100 }, { width: 0, height: 0 }),
    ).toBeNull()
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

describe('getPressedButtons', () => {
  it('maps each PointerEvent.buttons bit to the protocol button', () => {
    expect(getPressedButtons(1)).toEqual([0])
    expect(getPressedButtons(2)).toEqual([2])
    expect(getPressedButtons(4)).toEqual([1])
    expect(getPressedButtons(8)).toEqual([3])
    expect(getPressedButtons(16)).toEqual([4])
  })

  it('lists every chorded button and ignores bits it does not know', () => {
    expect(getPressedButtons(1 | 2 | 4)).toEqual([0, 2, 1])
    expect(getPressedButtons(32)).toEqual([])
    expect(getPressedButtons(0)).toEqual([])
  })
})

describe('toWheelUnits', () => {
  it('converts pixels to Windows units at about 120 per 100 pixels', () => {
    expect(toWheelUnits({ deltaX: 0, deltaY: 100, deltaMode: DOM_DELTA_PIXEL })).toEqual({
      dx: 0,
      dy: 120,
    })
  })

  it('converts lines and pages to units', () => {
    expect(toWheelUnits({ deltaX: 0, deltaY: 3, deltaMode: DOM_DELTA_LINE }).dy).toBe(360)
    expect(toWheelUnits({ deltaX: 1, deltaY: 0, deltaMode: DOM_DELTA_PAGE }).dx).toBe(1200)
  })

  it('keeps fractional units so small deltas add up within a frame', () => {
    expect(toWheelUnits({ deltaX: 0, deltaY: 1, deltaMode: DOM_DELTA_PIXEL }).dy).toBeCloseTo(1.2)
  })
})

describe('mergeWheelUnits', () => {
  it('sums the deltas of one frame', () => {
    const first = { dx: 10, dy: 100 }
    expect(mergeWheelUnits(null, first)).toEqual(first)
    expect(mergeWheelUnits(first, { dx: -4, dy: 20 })).toEqual({ dx: 6, dy: 120 })
  })
})

describe('buildWheelMessage', () => {
  it('builds a wheel message with the browser sign for dy', () => {
    expect(buildWheelMessage({ dx: 0, dy: 120 })).toBe('{"t":"wheel","dx":0,"dy":120}')
  })

  it('clamps the summed units to plus or minus 1200', () => {
    expect(buildWheelMessage({ dx: 5000, dy: -5000 })).toBe('{"t":"wheel","dx":1200,"dy":-1200}')
  })

  it('rounds and never writes negative zero', () => {
    expect(buildWheelMessage({ dx: -0.4, dy: 0.2 })).toBeNull()
    expect(buildWheelMessage({ dx: 0, dy: 0 })).toBeNull()
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
    expect(SECURE_ATTENTION_MESSAGE).toBe('{"t":"sas"}')
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

describe('createFrameCoalescer', () => {
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

  function createMoveRecorder() {
    const scheduler = createFakeScheduler()
    const sent: { x: number; y: number }[] = []
    const coalescer = createFrameCoalescer({
      merge: keepLatest,
      send: (point: { x: number; y: number }) => sent.push(point),
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
    })
    return { coalescer, sent, scheduler }
  }

  it('sends only the latest move on the next frame', () => {
    const { coalescer, sent, scheduler } = createMoveRecorder()
    coalescer.push({ x: 1, y: 1 })
    coalescer.push({ x: 2, y: 2 })
    coalescer.push({ x: 3, y: 3 })
    expect(sent).toEqual([])
    scheduler.runFrame()
    expect(sent).toEqual([{ x: 3, y: 3 }])
  })

  it('keeps at most one frame requested while one is pending', () => {
    const { coalescer, scheduler } = createMoveRecorder()
    coalescer.push({ x: 1, y: 1 })
    coalescer.push({ x: 2, y: 2 })
    expect(scheduler.pendingFrameCount()).toBe(1)
  })

  it('flush sends the pending item at once and cancels the frame', () => {
    const { coalescer, sent, scheduler } = createMoveRecorder()
    coalescer.push({ x: 4, y: 4 })
    coalescer.flush()
    expect(sent).toEqual([{ x: 4, y: 4 }])
    expect(scheduler.pendingFrameCount()).toBe(0)
  })

  it('flush sends nothing when nothing is pending', () => {
    const { coalescer, sent } = createMoveRecorder()
    coalescer.flush()
    expect(sent).toEqual([])
  })

  it('cancel drops the pending item', () => {
    const { coalescer, sent, scheduler } = createMoveRecorder()
    coalescer.push({ x: 5, y: 5 })
    coalescer.cancel()
    scheduler.runFrame()
    expect(sent).toEqual([])
  })

  it('schedules a new frame after the previous one ran', () => {
    const { coalescer, sent, scheduler } = createMoveRecorder()
    coalescer.push({ x: 1, y: 1 })
    scheduler.runFrame()
    coalescer.push({ x: 2, y: 2 })
    scheduler.runFrame()
    expect(sent).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
  })

  it('sums wheel deltas within one frame into a single send', () => {
    const scheduler = createFakeScheduler()
    const sent: string[] = []
    const coalescer = createFrameCoalescer({
      merge: mergeWheelUnits,
      send: (units: { dx: number; dy: number }) => {
        const message = buildWheelMessage(units)
        if (message) sent.push(message)
      },
      requestFrame: scheduler.requestFrame,
      cancelFrame: scheduler.cancelFrame,
    })
    coalescer.push({ dx: 0, dy: 60 })
    coalescer.push({ dx: 0, dy: 60 })
    coalescer.push({ dx: 0, dy: 1500 })
    scheduler.runFrame()
    expect(sent).toEqual(['{"t":"wheel","dx":0,"dy":1200}'])
  })
})
