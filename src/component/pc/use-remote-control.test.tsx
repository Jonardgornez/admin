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
    const { result } = renderHook(() => useRemoteControl({ screen: mock.screen, onReleaseShortcut: vi.fn() }))
    act(() => result.current.start())
    act(() => mock.serverSends({ control: 'on' }))

    act(() => result.current.sendSecureAttention())

    expect(mock.sendMessage).toHaveBeenLastCalledWith(SECURE_ATTENTION_TEXT)
    expect(sentSecureAttentionCount(mock.sendMessage)).toBe(1)
  })

  it('sends nothing while control is off', () => {
    const mock = mockScreen()
    const { result } = renderHook(() => useRemoteControl({ screen: mock.screen, onReleaseShortcut: vi.fn() }))

    act(() => result.current.sendSecureAttention())

    expect(mock.sendMessage).not.toHaveBeenCalled()
  })

  it('sends nothing while control is still being requested', () => {
    const mock = mockScreen()
    const { result } = renderHook(() => useRemoteControl({ screen: mock.screen, onReleaseShortcut: vi.fn() }))
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
      ({ status }) => useRemoteControl({ screen: screenWith(status), onReleaseShortcut: vi.fn() }),
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
    const { result } = renderHook(() => useRemoteControl({ screen, onReleaseShortcut: vi.fn() }))

    act(() => result.current.start())

    expect(result.current.state).toEqual({ kind: 'requesting' })
    expect(mock.sendMessage).toHaveBeenCalledWith('{"t":"control","on":true}')
  })
})
