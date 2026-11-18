// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ALREADY_PASTING_MESSAGE,
  MAX_PASTE_LENGTH,
  NOTHING_TO_PASTE_MESSAGE,
  PASTE_CHUNK_INTERVAL_MS,
  PASTE_NEEDS_CONTROL_MESSAGE,
  PASTE_TOO_LONG_MESSAGE,
} from '../../lib/paste-text'
import { usePasteText } from './use-paste-text'

interface HookProps {
  isEnabled: boolean
}

function renderSender(isEnabled = true) {
  const sendMessage = vi.fn((_message: string) => true)
  const hook = renderHook(
    ({ isEnabled: enabled }: HookProps) => usePasteText({ isEnabled: enabled, sendMessage }),
    { initialProps: { isEnabled } },
  )
  return { ...hook, sendMessage }
}

function sentChunks(sendMessage: ReturnType<typeof renderSender>['sendMessage']): string[] {
  return sendMessage.mock.calls.map(([message]) => (JSON.parse(message) as { s: string }).s)
}

function advanceOneInterval() {
  act(() => vi.advanceTimersByTime(PASTE_CHUNK_INTERVAL_MS))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePasteText', () => {
  it('sends a short paste as one {"t":"text"} message and ends at once', () => {
    const { result, sendMessage } = renderSender()

    act(() => {
      expect(result.current.pasteText('Hello\r\nworld')).toEqual({ success: true })
    })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith('{"t":"text","s":"Hello\\nworld"}')
    expect(result.current.progressPercent).toBeNull()
  })

  it('paces chunks one interval apart and reports progress', () => {
    const { result, sendMessage } = renderSender()
    act(() => {
      result.current.pasteText('a'.repeat(64 * 4))
    })

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(result.current.progressPercent).toBe(25)

    act(() => vi.advanceTimersByTime(PASTE_CHUNK_INTERVAL_MS - 1))
    expect(sendMessage).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(1))
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(result.current.progressPercent).toBe(50)

    advanceOneInterval()
    advanceOneInterval()
    expect(sendMessage).toHaveBeenCalledTimes(4)
    expect(sentChunks(sendMessage).join('')).toBe('a'.repeat(64 * 4))
    expect(result.current.progressPercent).toBeNull()
    expect(result.current.outcome).toBe('typed')
  })

  it('never sends more than 13 chunks in a second', () => {
    const { result, sendMessage } = renderSender()
    act(() => {
      result.current.pasteText('a'.repeat(64 * 40))
    })

    act(() => vi.advanceTimersByTime(1000))

    expect(sendMessage.mock.calls.length).toBeLessThanOrEqual(13)
  })

  it('refuses a second paste while one is being typed', () => {
    const { result, sendMessage } = renderSender()
    act(() => {
      result.current.pasteText('a'.repeat(200))
    })

    let second: ReturnType<typeof result.current.pasteText> | undefined
    act(() => {
      second = result.current.pasteText('b')
    })

    expect(second).toEqual({ success: false, error: ALREADY_PASTING_MESSAGE })
    expect(sentChunks(sendMessage).join('')).not.toContain('b')
  })

  it('refuses empty and too long text without sending anything', () => {
    const { result, sendMessage } = renderSender()

    expect(result.current.pasteText('')).toEqual({ success: false, error: NOTHING_TO_PASTE_MESSAGE })
    expect(result.current.pasteText('a'.repeat(MAX_PASTE_LENGTH + 1))).toEqual({
      success: false,
      error: PASTE_TOO_LONG_MESSAGE,
    })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('refuses to paste while control is off', () => {
    const { result, sendMessage } = renderSender(false)

    expect(result.current.pasteText('hi')).toEqual({ success: false, error: PASTE_NEEDS_CONTROL_MESSAGE })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('stops sending when Stop is pressed, and allows a new paste afterwards', () => {
    const { result, sendMessage } = renderSender()
    act(() => {
      result.current.pasteText('a'.repeat(64 * 3))
    })

    act(() => result.current.stopPaste())
    act(() => vi.advanceTimersByTime(PASTE_CHUNK_INTERVAL_MS * 5))

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(result.current.progressPercent).toBeNull()
    expect(result.current.outcome).toBe('stopped')
    act(() => {
      expect(result.current.pasteText('b')).toEqual({ success: true })
    })
    expect(result.current.outcome).toBe('typed')
  })

  it('stops sending when control turns off', () => {
    const { result, sendMessage, rerender } = renderSender()
    act(() => {
      result.current.pasteText('a'.repeat(64 * 3))
    })

    rerender({ isEnabled: false })
    act(() => vi.advanceTimersByTime(PASTE_CHUNK_INTERVAL_MS * 5))

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(result.current.progressPercent).toBeNull()
    expect(result.current.outcome).toBe('stopped')
  })

  it('keeps a finished paste as typed when control turns off afterwards', () => {
    const { result, rerender } = renderSender()
    act(() => {
      result.current.pasteText('done')
    })

    rerender({ isEnabled: false })

    expect(result.current.outcome).toBe('typed')
  })

  it('has no outcome before any paste', () => {
    const { result } = renderSender()
    expect(result.current.outcome).toBeNull()
  })

  it('stops sending once the socket refuses a message', () => {
    const { result, sendMessage } = renderSender()
    act(() => {
      result.current.pasteText('a'.repeat(64 * 3))
    })

    sendMessage.mockReturnValue(false)
    act(() => vi.advanceTimersByTime(PASTE_CHUNK_INTERVAL_MS * 5))

    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(result.current.progressPercent).toBeNull()
  })

  it('stops sending on unmount', () => {
    const { result, sendMessage, unmount } = renderSender()
    act(() => {
      result.current.pasteText('a'.repeat(64 * 3))
    })

    unmount()
    vi.advanceTimersByTime(PASTE_CHUNK_INTERVAL_MS * 5)

    expect(sendMessage).toHaveBeenCalledTimes(1)
  })
})
