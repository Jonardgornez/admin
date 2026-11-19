// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RemoteControlState } from '../../lib/remote-control'
import type { ServerCursorMessage } from '../../lib/remote-cursor'
import { useRemoteCursor } from './use-remote-cursor'
import type { ScreenSocketEvent, ScreenSocketListener } from './use-screen-stream'

const PNG = 'iVBORw0KGgo='

interface ControlProps {
  controlKind: RemoteControlState['kind']
}

function renderCursor(initialKind: RemoteControlState['kind']) {
  const canvas = document.createElement('canvas')
  const canvasRef = { current: canvas }
  const listeners = new Set<ScreenSocketListener>()
  const subscribe = (listener: ScreenSocketListener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const hook = renderHook<void, ControlProps>(
    ({ controlKind }) => useRemoteCursor({ canvasRef, controlKind, subscribe }),
    { initialProps: { controlKind: initialKind } },
  )

  function emit(event: ScreenSocketEvent) {
    act(() => listeners.forEach((listener) => listener(event)))
  }

  function serverSendsCursor(message: ServerCursorMessage) {
    emit({ kind: 'cursor', message })
  }

  function setControl(controlKind: RemoteControlState['kind']) {
    hook.rerender({ controlKind })
  }

  return { ...hook, canvas, emit, serverSendsCursor, setControl }
}

describe('useRemoteCursor', () => {
  it('applies a standard cursor while control is on', () => {
    const { canvas, serverSendsCursor } = renderCursor('on')

    serverSendsCursor({ cursor: 'text' })

    expect(canvas.style.cursor).toBe('text')
  })

  it('applies an image cursor while control is on', () => {
    const { canvas, serverSendsCursor } = renderCursor('on')

    serverSendsCursor({ cursor: 'image', x: 2, y: 4, png: PNG })

    expect(canvas.style.cursor).toContain(`data:image/png;base64,${PNG}`)
  })

  it('applies a shape that arrived just before the on state rendered', () => {
    const { canvas, serverSendsCursor, setControl } = renderCursor('requesting')
    serverSendsCursor({ cursor: 'move' })
    expect(canvas.style.cursor).toBe('')

    setControl('on')

    expect(canvas.style.cursor).toBe('move')
  })

  it('ignores cursor messages while control is off', () => {
    const { canvas, serverSendsCursor, setControl } = renderCursor('off')

    serverSendsCursor({ cursor: 'wait' })
    expect(canvas.style.cursor).toBe('')
    setControl('requesting')
    setControl('on')

    expect(canvas.style.cursor).toBe('')
  })

  it('resets to the normal cursor when control turns off', () => {
    const { canvas, serverSendsCursor, setControl } = renderCursor('on')
    serverSendsCursor({ cursor: 'pointer' })

    setControl('off')

    expect(canvas.style.cursor).toBe('')
  })

  it('forgets the last shape once control turns off', () => {
    const { canvas, serverSendsCursor, setControl } = renderCursor('on')
    serverSendsCursor({ cursor: 'pointer' })
    setControl('off')

    setControl('requesting')
    setControl('on')

    expect(canvas.style.cursor).toBe('')
  })

  it('resets to the normal cursor when the socket closes', () => {
    const { canvas, emit, serverSendsCursor } = renderCursor('on')
    serverSendsCursor({ cursor: 'crosshair' })

    emit({ kind: 'closed' })

    expect(canvas.style.cursor).toBe('')
  })

  it('resets to the normal cursor when the view unmounts', () => {
    const { canvas, serverSendsCursor, unmount } = renderCursor('on')
    serverSendsCursor({ cursor: 'help' })

    unmount()

    expect(canvas.style.cursor).toBe('')
  })
})
