// @vitest-environment jsdom
import { createRef } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ScreenStreamStatus } from '../../lib/screen-stream'
import type { ServerControlMessage } from '../../lib/remote-input'
import { useRemoteControl } from './use-remote-control'
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
