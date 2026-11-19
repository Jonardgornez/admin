// @vitest-environment jsdom
import { createRef } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ScreenStreamStatus } from '../../lib/screen-stream'
import type { ServerControlMessage } from '../../lib/remote-input'
import { useRemoteControl, type RemoteControl } from './use-remote-control'
import type { ScreenSocketListener } from './use-screen-stream'

const SECURE_ATTENTION_TEXT = '{"t":"sas"}'

// A screen with a mocked control socket. Sent texts are recorded, and the server's replies are played through the listeners.
function mockScreen() {
  const sendMessage = vi.fn((_message: string) => true)
  const listeners = new Set<ScreenSocketListener>()
  const subscribe = vi.fn((listener: ScreenSocketListener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  })
  const status: ScreenStreamStatus = { kind: 'live' }
  const screen = { canvasRef: createRef<HTMLCanvasElement>(), status, sendMessage, subscribe }

  function serverSends(message: ServerControlMessage) {
    listeners.forEach((listener) => listener({ kind: 'control', message }))
  }

  return { screen, sendMessage, serverSends }
}

function sentSecureAttentionCount(sendMessage: ReturnType<typeof mockScreen>['sendMessage']): number {
  return sendMessage.mock.calls.filter(([message]) => message === SECURE_ATTENTION_TEXT).length
}

describe('useRemoteControl sendSecureAttention', () => {
  it('sends exactly {"t":"sas"} over the control socket while control is on', () => {
    const mock = mockScreen()
    const { result } = renderHook(() => useRemoteControl({ screen: mock.screen, onReleaseShortcut: vi.fn(), onPasteRefused: vi.fn() }))
    act(() => result.current.start())
    act(() => mock.serverSends({ control: 'on' }))

    act(() => result.current.sendSecureAttention())

    expect(mock.sendMessage).toHaveBeenLastCalledWith(SECURE_ATTENTION_TEXT)
    expect(sentSecureAttentionCount(mock.sendMessage)).toBe(1)
  })

  it('sends nothing while control is off', () => {
    const mock = mockScreen()
    const { result } = renderHook(() => useRemoteControl({ screen: mock.screen, onReleaseShortcut: vi.fn(), onPasteRefused: vi.fn() }))

    act(() => result.current.sendSecureAttention())

    expect(mock.sendMessage).not.toHaveBeenCalled()
  })

  it('sends nothing while control is still being requested', () => {
    const mock = mockScreen()
    const { result } = renderHook(() => useRemoteControl({ screen: mock.screen, onReleaseShortcut: vi.fn(), onPasteRefused: vi.fn() }))
    act(() => result.current.start())

    act(() => result.current.sendSecureAttention())

    expect(sentSecureAttentionCount(mock.sendMessage)).toBe(0)
  })
})

interface StatusProps {
  status: ScreenStreamStatus
}

describe('useRemoteControl with a protected screen', () => {
  // Control is turned on over a live picture, then the stream status changes through rerender.
  function renderControlOn() {
    const mock = mockScreen()
    const listeners = new Set<ScreenSocketListener>()
    const screenWith = (status: ScreenStreamStatus) => ({
      ...mock.screen,
      status,
      subscribe: (listener: ScreenSocketListener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    })
    const hook = renderHook<RemoteControl, StatusProps>(
      ({ status }) => useRemoteControl({ screen: screenWith(status), onReleaseShortcut: vi.fn(), onPasteRefused: vi.fn() }),
      { initialProps: { status: { kind: 'live' } } },
    )
    act(() => hook.result.current.start())
    act(() => listeners.forEach((listener) => listener({ kind: 'control', message: { control: 'on' } })))

    function serverStateChanges(state: 'live' | 'secure' | 'paused') {
      // The stream notifies listeners before the page re-renders with the new status.
      act(() => listeners.forEach((listener) => listener({ kind: 'server-state', state })))
      hook.rerender({ status: { kind: state } })
    }

    return { ...hook, sendMessage: mock.sendMessage, serverStateChanges }
  }

  it('keeps control on and sends no control off when the screen turns secure', () => {
    const { result, sendMessage, serverStateChanges } = renderControlOn()
    sendMessage.mockClear()

    serverStateChanges('secure')

    expect(result.current.state).toEqual({ kind: 'on' })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('keeps control on when the screen goes from secure back to live', () => {
    const { result, serverStateChanges } = renderControlOn()
    serverStateChanges('secure')

    serverStateChanges('live')

    expect(result.current.state).toEqual({ kind: 'on' })
  })

  it('still sends Ctrl+Alt+Del while the screen is secure', () => {
    const { result, sendMessage, serverStateChanges } = renderControlOn()
    serverStateChanges('secure')

    act(() => result.current.sendSecureAttention())

    expect(sendMessage).toHaveBeenLastCalledWith(SECURE_ATTENTION_TEXT)
  })

  it('still ends control with the paused reason when the screen pauses without a helper', () => {
    const { result, sendMessage, serverStateChanges } = renderControlOn()

    serverStateChanges('paused')

    expect(result.current.state).toEqual({ kind: 'off', reason: 'paused' })
    expect(sendMessage).toHaveBeenCalledWith('{"t":"control","on":false}')
  })

  it('lets control start while the screen is secure', () => {
    const mock = mockScreen()
    const status: ScreenStreamStatus = { kind: 'secure' }
    const screen = { ...mock.screen, status }
    const { result } = renderHook(() => useRemoteControl({ screen, onReleaseShortcut: vi.fn(), onPasteRefused: vi.fn() }))

    act(() => result.current.start())

    expect(result.current.state).toEqual({ kind: 'requesting' })
    expect(mock.sendMessage).toHaveBeenCalledWith('{"t":"control","on":true}')
  })
})

describe('useRemoteControl paste', () => {
  // Control is on over a focused screen canvas that is in the document, so key and paste listeners are attached.
  function renderControlOnWithCanvas() {
    const mock = mockScreen()
    const canvas = document.createElement('canvas')
    canvas.tabIndex = 0
    document.body.append(canvas)
    mock.screen.canvasRef.current = canvas
    const onPasteRefused = vi.fn()
    const hook = renderHook(() =>
      useRemoteControl({ screen: mock.screen, onReleaseShortcut: vi.fn(), onPasteRefused }),
    )
    act(() => hook.result.current.start())
    act(() => mock.serverSends({ control: 'on' }))
    canvas.focus()
    mock.sendMessage.mockClear()

    function paste(text: string | null, target: EventTarget = canvas) {
      const event = new Event('paste', { bubbles: true, cancelable: true })
      const clipboardData = text === null ? null : { getData: (type: string) => (type === 'text/plain' ? text : '') }
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
      act(() => {
        target.dispatchEvent(event)
      })
      return event
    }

    function key(type: 'keydown' | 'keyup', init: KeyboardEventInit) {
      const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
      act(() => {
        canvas.dispatchEvent(event)
      })
      return event
    }

    function cleanup() {
      hook.unmount()
      canvas.remove()
    }

    return { ...hook, canvas, sendMessage: mock.sendMessage, onPasteRefused, paste, key, cleanup }
  }

  function sentTexts(sendMessage: ReturnType<typeof mockScreen>['sendMessage']): string[] {
    return sendMessage.mock.calls.map(([message]) => message)
  }

  it('types the clipboard text on the PC and prevents the browser paste', () => {
    const view = renderControlOnWithCanvas()

    const event = view.paste('Hi\r\nthere')

    expect(event.defaultPrevented).toBe(true)
    expect(view.sendMessage).toHaveBeenCalledWith(JSON.stringify({ t: 'text', s: 'Hi\nthere' }))
    view.cleanup()
  })

  it('reports a clipboard without text and sends nothing', () => {
    const view = renderControlOnWithCanvas()

    view.paste('')
    view.paste(null)

    expect(view.onPasteRefused).toHaveBeenCalledWith('Nothing to paste — the clipboard has no text.')
    expect(view.onPasteRefused).toHaveBeenCalledTimes(2)
    expect(view.sendMessage).not.toHaveBeenCalled()
    view.cleanup()
  })

  it('refuses a second clipboard paste while the first is still typing', () => {
    const view = renderControlOnWithCanvas()

    view.paste('a'.repeat(200))
    view.paste('b')

    expect(view.onPasteRefused).toHaveBeenCalledWith(
      'Text is already being typed on the PC. Wait for it to finish or press Stop.',
    )
    expect(view.result.current.pasteProgressPercent).not.toBeNull()
    view.cleanup()
  })

  it('leaves a paste into another element alone', () => {
    const view = renderControlOnWithCanvas()
    const textArea = document.createElement('textarea')
    document.body.append(textArea)
    textArea.focus()

    const event = view.paste('hello', textArea)

    expect(event.defaultPrevented).toBe(false)
    // Leaving the screen releases held keys, but nothing is typed.
    expect(sentTexts(view.sendMessage)).toEqual(['{"t":"release"}'])
    textArea.remove()
    view.cleanup()
  })

  it.each([
    { code: 'KeyV', ctrlKey: true },
    { code: 'KeyV', metaKey: true },
    { code: 'Insert', shiftKey: true },
  ])('keeps the paste shortcut %o from the PC and lets the browser paste', (init) => {
    const view = renderControlOnWithCanvas()

    const down = view.key('keydown', init)
    const up = view.key('keyup', init)

    expect(down.defaultPrevented).toBe(false)
    expect(up.defaultPrevented).toBe(true)
    expect(sentTexts(view.sendMessage).filter((message) => message.includes('"t":"key"'))).toEqual([])
    view.cleanup()
  })

  it('still sends Ctrl to the PC, but not the V of Ctrl+V, so no key stays held', () => {
    const view = renderControlOnWithCanvas()

    view.key('keydown', { code: 'ControlLeft', ctrlKey: true })
    view.key('keydown', { code: 'KeyV', ctrlKey: true })
    view.key('keyup', { code: 'KeyV', ctrlKey: true })
    view.key('keyup', { code: 'ControlLeft' })

    expect(sentTexts(view.sendMessage)).toEqual([
      '{"t":"key","c":"ControlLeft","d":true}',
      '{"t":"key","c":"ControlLeft","d":false}',
    ])
    view.cleanup()
  })

  it('keeps V from the PC after Ctrl+V when Ctrl is let go first and V keeps repeating', () => {
    const view = renderControlOnWithCanvas()

    view.key('keydown', { code: 'ControlLeft', ctrlKey: true })
    view.key('keydown', { code: 'KeyV', ctrlKey: true })
    view.key('keyup', { code: 'ControlLeft' })
    const repeat = view.key('keydown', { code: 'KeyV', repeat: true })
    view.key('keyup', { code: 'KeyV' })

    expect(repeat.defaultPrevented).toBe(true)
    expect(sentTexts(view.sendMessage)).toEqual([
      '{"t":"key","c":"ControlLeft","d":true}',
      '{"t":"key","c":"ControlLeft","d":false}',
    ])
    view.cleanup()
  })

  it('sends the V key-up when V was already held on the PC before Ctrl was pressed', () => {
    const view = renderControlOnWithCanvas()

    view.key('keydown', { code: 'KeyV' })
    view.key('keydown', { code: 'ControlLeft', ctrlKey: true })
    view.key('keydown', { code: 'KeyV', ctrlKey: true, repeat: true })
    view.key('keyup', { code: 'KeyV', ctrlKey: true })
    view.key('keyup', { code: 'ControlLeft' })

    expect(sentTexts(view.sendMessage)).toEqual([
      '{"t":"key","c":"KeyV","d":true}',
      '{"t":"key","c":"ControlLeft","d":true}',
      '{"t":"key","c":"KeyV","d":true}',
      '{"t":"key","c":"KeyV","d":false}',
      '{"t":"key","c":"ControlLeft","d":false}',
    ])
    view.cleanup()
  })

  it('pastes again with Ctrl+V once V was let go', () => {
    const view = renderControlOnWithCanvas()

    view.key('keydown', { code: 'KeyV' })
    view.key('keyup', { code: 'KeyV' })
    view.sendMessage.mockClear()
    const down = view.key('keydown', { code: 'KeyV', ctrlKey: true })
    view.key('keyup', { code: 'KeyV', ctrlKey: true })

    expect(down.defaultPrevented).toBe(false)
    expect(view.sendMessage).not.toHaveBeenCalled()
    view.cleanup()
  })

  it('prevents an auto-repeated paste shortcut, so holding it pastes once', () => {
    const view = renderControlOnWithCanvas()

    view.key('keydown', { code: 'KeyV', ctrlKey: true })
    const repeat = view.key('keydown', { code: 'KeyV', ctrlKey: true, repeat: true })

    expect(repeat.defaultPrevented).toBe(true)
    expect(view.sendMessage).not.toHaveBeenCalled()
    view.cleanup()
  })

  it('forwards a plain V press as usual', () => {
    const view = renderControlOnWithCanvas()

    const down = view.key('keydown', { code: 'KeyV' })
    view.key('keyup', { code: 'KeyV' })

    expect(down.defaultPrevented).toBe(true)
    expect(sentTexts(view.sendMessage)).toEqual([
      '{"t":"key","c":"KeyV","d":true}',
      '{"t":"key","c":"KeyV","d":false}',
    ])
    view.cleanup()
  })

  it('ignores the clipboard after control stops and stops the typing', () => {
    vi.useFakeTimers()
    const view = renderControlOnWithCanvas()
    view.paste('a'.repeat(200))

    act(() => view.result.current.stop())
    view.sendMessage.mockClear()
    act(() => vi.advanceTimersByTime(1000))
    const event = view.paste('more')

    expect(event.defaultPrevented).toBe(false)
    expect(sentTexts(view.sendMessage).filter((message) => message.includes('"t":"text"'))).toEqual([])
    expect(view.result.current.pasteProgressPercent).toBeNull()
    view.cleanup()
    vi.useRealTimers()
  })

  it('stops typing when the socket closes', () => {
    vi.useFakeTimers()
    const mock = mockScreen()
    const listeners = new Set<ScreenSocketListener>()
    const screen = {
      ...mock.screen,
      subscribe: (listener: ScreenSocketListener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    }
    const { result } = renderHook(() =>
      useRemoteControl({ screen, onReleaseShortcut: vi.fn(), onPasteRefused: vi.fn() }),
    )
    act(() => result.current.start())
    act(() => listeners.forEach((listener) => listener({ kind: 'control', message: { control: 'on' } })))
    act(() => {
      result.current.pasteText('a'.repeat(200))
    })

    act(() => listeners.forEach((listener) => listener({ kind: 'closed' })))
    mock.sendMessage.mockClear()
    act(() => vi.advanceTimersByTime(1000))

    expect(mock.sendMessage).not.toHaveBeenCalled()
    expect(result.current.pasteProgressPercent).toBeNull()
    vi.useRealTimers()
  })
})

describe('useRemoteControl pointer shape', () => {
  it('shows the PC pointer shape on the canvas only while control is on', () => {
    const mock = mockScreen()
    const canvas = document.createElement('canvas')
    mock.screen.canvasRef.current = canvas
    const listeners = new Set<ScreenSocketListener>()
    const screen = {
      ...mock.screen,
      subscribe: (listener: ScreenSocketListener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    }
    const emit = (event: Parameters<ScreenSocketListener>[0]) =>
      act(() => listeners.forEach((listener) => listener(event)))
    const { result } = renderHook(() =>
      useRemoteControl({ screen, onReleaseShortcut: vi.fn(), onPasteRefused: vi.fn() }),
    )

    emit({ kind: 'cursor', message: { cursor: 'text' } })
    expect(canvas.style.cursor).toBe('')

    act(() => result.current.start())
    emit({ kind: 'control', message: { control: 'on' } })
    emit({ kind: 'cursor', message: { cursor: 'text' } })
    expect(canvas.style.cursor).toBe('text')

    act(() => result.current.stop())
    expect(canvas.style.cursor).toBe('')
  })
})
