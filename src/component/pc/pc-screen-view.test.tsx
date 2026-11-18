// @vitest-environment jsdom
import { createRef } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScreenStreamStatus } from '../../lib/screen-stream'
import { NotificationContext } from '../ui/notification-context'
import { PcScreenView } from './pc-screen-view'
import { useRemoteControl } from './use-remote-control'
import type { ScreenSocketListener } from './use-screen-stream'

const SECURE_ATTENTION_BUTTON_NAME = 'Send Ctrl+Alt+Del'

function renderView(
  isControlling: boolean,
  onSendSecureAttention?: () => void,
  isProtectedScreen = false,
) {
  return render(
    <NotificationContext.Provider value={vi.fn()}>
      <PcScreenView
        pcName="PC-01"
        isOffline={false}
        isControlling={isControlling}
        isStopHintShown={false}
        isFrameVisible
        isProtectedScreen={isProtectedScreen}
        placeholderText=""
        viewModeLabel="Notified view"
        canvasRef={createRef<HTMLCanvasElement>()}
        stopButtonRef={createRef<HTMLButtonElement>()}
        onStopControl={vi.fn()}
        onSendSecureAttention={onSendSecureAttention}
      />
    </NotificationContext.Provider>,
  )
}

describe('PcScreenView Ctrl+Alt+Del button', () => {
  it('is hidden while control is off', () => {
    renderView(false, vi.fn())

    expect(screen.queryByRole('button', { name: SECURE_ATTENTION_BUTTON_NAME })).toBeNull()
  })

  it('is hidden while controlling when no handler is given, as while the PC client cannot act on it', () => {
    renderView(true)

    expect(screen.queryByRole('button', { name: SECURE_ATTENTION_BUTTON_NAME })).toBeNull()
  })

  it('is shown while control is on, and calls the handler once when clicked', () => {
    const onSendSecureAttention = vi.fn()
    renderView(true, onSendSecureAttention)

    fireEvent.click(screen.getByRole('button', { name: SECURE_ATTENTION_BUTTON_NAME }))

    expect(onSendSecureAttention).toHaveBeenCalledTimes(1)
  })

  it('sends exactly {"t":"sas"} over the mocked control socket when clicked', () => {
    const sendMessage = vi.fn((_message: string) => true)
    const listeners = new Set<ScreenSocketListener>()
    const status: ScreenStreamStatus = { kind: 'live' }
    const { result } = renderHook(() =>
      useRemoteControl({
        screen: {
          canvasRef: createRef<HTMLCanvasElement>(),
          status,
          sendMessage,
          subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
          },
        },
        onReleaseShortcut: vi.fn(),
      }),
    )
    act(() => result.current.start())
    act(() => listeners.forEach((listener) => listener({ kind: 'control', message: { control: 'on' } })))
    renderView(result.current.state.kind === 'on', result.current.sendSecureAttention)

    fireEvent.click(screen.getByRole('button', { name: SECURE_ATTENTION_BUTTON_NAME }))

    expect(sendMessage).toHaveBeenLastCalledWith('{"t":"sas"}')
  })
})

describe('PcScreenView protected screen badge', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'fullscreenElement')
  })

  // The page header is hidden in full view, so the view shows the badge in its own header there.
  function enterFullView(container: HTMLElement) {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => container.firstElementChild,
    })
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
  }

  it('shows "PC reports a protected screen" as text in full view while the screen is secure', () => {
    const { container } = renderView(true, vi.fn(), true)
    enterFullView(container)

    expect(screen.getByText('PC reports a protected screen')).toBeTruthy()
  })

  it('hides the badge in full view once the screen is live again', () => {
    const { container, rerender } = renderView(true, vi.fn(), true)
    enterFullView(container)

    rerender(
      <NotificationContext.Provider value={vi.fn()}>
        <PcScreenView
          pcName="PC-01"
          isOffline={false}
          isControlling
          isStopHintShown={false}
          isFrameVisible
          isProtectedScreen={false}
          placeholderText=""
          viewModeLabel="Notified view"
          canvasRef={createRef<HTMLCanvasElement>()}
          stopButtonRef={createRef<HTMLButtonElement>()}
          onStopControl={vi.fn()}
        />
      </NotificationContext.Provider>,
    )

    expect(screen.queryByText('PC reports a protected screen')).toBeNull()
  })

  it('keeps the picture and Ctrl+Alt+Del available while the screen is secure', () => {
    const { container } = renderView(true, vi.fn(), true)

    expect(container.querySelector('canvas')?.hidden).toBe(false)
    expect(screen.getByRole('button', { name: SECURE_ATTENTION_BUTTON_NAME })).toBeTruthy()
  })
})
