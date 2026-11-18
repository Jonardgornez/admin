// @vitest-environment jsdom
import { createRef } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PasteOutcome } from '../../lib/paste-text'
import type { ScreenStreamStatus } from '../../lib/screen-stream'
import { NotificationContext } from '../ui/notification-context'
import { PcScreenView } from './pc-screen-view'
import type { PasteTextResult } from './use-paste-text'
import { useRemoteControl } from './use-remote-control'
import type { ScreenSocketListener } from './use-screen-stream'

const SECURE_ATTENTION_BUTTON_NAME = 'Send Ctrl+Alt+Del'

interface PasteProps {
  pasteProgressPercent?: number | null
  pasteOutcome?: PasteOutcome | null
  onPasteText?: (text: string) => PasteTextResult
  onStopPaste?: () => void
}

function renderView(
  isControlling: boolean,
  onSendSecureAttention?: () => void,
  isProtectedScreen = false,
  {
    pasteProgressPercent = null,
    pasteOutcome = null,
    onPasteText = vi.fn(() => ({ success: true as const })),
    onStopPaste = vi.fn(),
  }: PasteProps = {},
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
        pasteProgressPercent={pasteProgressPercent}
        pasteOutcome={pasteOutcome}
        onPasteText={onPasteText}
        onStopPaste={onStopPaste}
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
        onPasteRefused: vi.fn(),
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
          pasteProgressPercent={null}
          pasteOutcome={null}
          onPasteText={vi.fn(() => ({ success: true as const }))}
          onStopPaste={vi.fn()}
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

describe('PcScreenView paste text', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  })

  it('hides Paste text while control is off', () => {
    renderView(false, vi.fn())

    expect(screen.queryByRole('button', { name: 'Paste text' })).toBeNull()
  })

  it('shows Paste text next to Ctrl+Alt+Del while controlling and opens the dialog', () => {
    renderView(true, vi.fn())

    fireEvent.click(screen.getByRole('button', { name: 'Paste text' }))

    expect(screen.getByLabelText('Text to type')).toBeTruthy()
  })

  it('types the dialog text through the handler', async () => {
    const onPasteText = vi.fn((_text: string) => ({ success: true as const }))
    renderView(true, vi.fn(), false, { onPasteText })
    fireEvent.click(screen.getByRole('button', { name: 'Paste text' }))

    fireEvent.change(screen.getByLabelText('Text to type'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Type on PC' }))

    await vi.waitFor(() => expect(onPasteText).toHaveBeenCalledWith('hello'))
    expect(screen.queryByLabelText('Text to type')).toBeNull()
  })

  it('shows the typing progress with a working Stop button', () => {
    const onStopPaste = vi.fn()
    renderView(true, vi.fn(), false, { pasteProgressPercent: 30, onStopPaste })

    expect(screen.getByText('Typing… 30%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Stop typing' }))
    expect(onStopPaste).toHaveBeenCalledTimes(1)
  })

  it.each([
    [0, null, 'Typing…'],
    [37, null, 'Typing… 25%'],
    [null, 'typed', 'Typed on the PC.'],
    [null, 'stopped', 'Stopped.'],
  ] as const)('announces progress %s with outcome %s as %j', (percent, outcome, announcement) => {
    const { container } = renderView(true, vi.fn(), false, {
      pasteProgressPercent: percent,
      pasteOutcome: outcome,
    })

    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(announcement)
  })

  it('shows no progress while nothing is being typed', () => {
    renderView(true, vi.fn())

    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
