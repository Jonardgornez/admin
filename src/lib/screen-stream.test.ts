import { describe, expect, it } from 'vitest'
import {
  buildScreenshotFilename,
  buildScreenStreamUrl,
  describeScreenClose,
  getScreenPlaceholderText,
  getScreenRetryDelayMs,
  getScreenStatusLabel,
  isActiveScreenStatus,
  LatestFrameQueue,
  PAUSED_MESSAGE,
  parseScreenStateMessage,
  PC_GONE_MESSAGE,
  type ScreenStreamStatus,
} from './screen-stream'

describe('buildScreenStreamUrl', () => {
  it('uses ws for http pages and wss for https pages', () => {
    expect(buildScreenStreamUrl({ protocol: 'http:', host: 'localhost:5173' }, 4, 'notified')).toBe(
      'ws://localhost:5173/api/pcs/4/screen/live?mode=notified',
    )
    expect(buildScreenStreamUrl({ protocol: 'https:', host: 'admin.local' }, 4, 'anonymous')).toBe(
      'wss://admin.local/api/pcs/4/screen/live?mode=anonymous',
    )
  })

  it('throws for a mode the server does not accept', () => {
    expect(() =>
      buildScreenStreamUrl(
        { protocol: 'http:', host: 'localhost' },
        4,
        'secret' as unknown as 'notified',
      ),
    ).toThrow()
  })
})

describe('parseScreenStateMessage', () => {
  it('reads each state the server can send', () => {
    expect(parseScreenStateMessage('{"state":"waiting"}')).toBe('waiting')
    expect(parseScreenStateMessage('{"state":"live"}')).toBe('live')
    expect(parseScreenStateMessage('{"state":"paused"}')).toBe('paused')
  })

  it('returns null for text that is not JSON', () => {
    expect(parseScreenStateMessage('live')).toBeNull()
  })

  it('returns null for an unknown state', () => {
    expect(parseScreenStateMessage('{"state":"frozen"}')).toBeNull()
    expect(parseScreenStateMessage('{}')).toBeNull()
  })
})

describe('describeScreenClose', () => {
  it('ends the session on 4003 and never retries it', () => {
    expect(describeScreenClose(4003)).toMatchObject({ isSessionEnded: true, canRetry: false })
  })

  it('never retries a replaced or offline PC', () => {
    expect(describeScreenClose(4001)).toMatchObject({ canRetry: false, isSessionEnded: false })
    expect(describeScreenClose(4002)).toEqual({
      message: PC_GONE_MESSAGE,
      canRetry: false,
      isSessionEnded: false,
    })
  })

  it('retries abnormal closes such as 1006, 1001 and 1008', () => {
    expect(describeScreenClose(1006).canRetry).toBe(true)
    expect(describeScreenClose(1001).canRetry).toBe(true)
    expect(describeScreenClose(1008).canRetry).toBe(true)
  })

  it('does not retry a normal close or an unknown code', () => {
    expect(describeScreenClose(1000).canRetry).toBe(false)
    expect(describeScreenClose(4999).canRetry).toBe(false)
  })

  it('gives every close a user message', () => {
    expect(describeScreenClose(1000).message).not.toBe('')
    expect(describeScreenClose(4999).message).not.toBe('')
  })
})

describe('getScreenRetryDelayMs', () => {
  it('doubles the wait for each automatic retry', () => {
    expect(getScreenRetryDelayMs(1)).toBe(1000)
    expect(getScreenRetryDelayMs(2)).toBe(2000)
    expect(getScreenRetryDelayMs(3)).toBe(4000)
    expect(getScreenRetryDelayMs(4)).toBe(8000)
  })

  it('stops after a bounded number of retries', () => {
    expect(getScreenRetryDelayMs(5)).toBeNull()
  })

  it('rejects a retry number below 1', () => {
    expect(getScreenRetryDelayMs(0)).toBeNull()
  })
})

describe('isActiveScreenStatus', () => {
  it('is true while a connection is open or opening', () => {
    expect(isActiveScreenStatus({ kind: 'connecting' })).toBe(true)
    expect(isActiveScreenStatus({ kind: 'waiting' })).toBe(true)
    expect(isActiveScreenStatus({ kind: 'live' })).toBe(true)
    expect(isActiveScreenStatus({ kind: 'paused' })).toBe(true)
  })

  it('is false when idle or ended', () => {
    expect(isActiveScreenStatus({ kind: 'idle' })).toBe(false)
    expect(isActiveScreenStatus({ kind: 'ended', message: 'Done.' })).toBe(false)
  })
})

describe('getScreenStatusLabel', () => {
  it('names each status', () => {
    expect(getScreenStatusLabel({ kind: 'connecting' })).toBe('Connecting')
    expect(getScreenStatusLabel({ kind: 'waiting' })).toBe('Waiting for the PC')
    expect(getScreenStatusLabel({ kind: 'live' })).toBe('Live')
    expect(getScreenStatusLabel({ kind: 'paused' })).toBe('Paused')
    expect(getScreenStatusLabel({ kind: 'ended', message: 'Done.' })).toBe('Ended')
  })
})

describe('getScreenPlaceholderText', () => {
  it('explains the paused screen with the protected-screen message', () => {
    expect(getScreenPlaceholderText({ kind: 'paused' })).toBe(PAUSED_MESSAGE)
  })

  it('gives a placeholder for every status', () => {
    const statuses: ScreenStreamStatus[] = [
      { kind: 'idle' },
      { kind: 'connecting' },
      { kind: 'waiting' },
      { kind: 'live' },
      { kind: 'paused' },
      { kind: 'ended', message: 'Done.' },
    ]
    for (const status of statuses) {
      expect(getScreenPlaceholderText(status)).not.toBe('')
    }
  })
})

describe('buildScreenshotFilename', () => {
  it('uses the PC name and a local timestamp', () => {
    expect(buildScreenshotFilename('PC-03', new Date(2026, 10, 6, 9, 5, 7))).toBe(
      'PC-03-20261106-090507.png',
    )
  })

  it('replaces characters that are not allowed in file names', () => {
    expect(buildScreenshotFilename('LAB:1/A', new Date(2026, 0, 2, 3, 4, 5))).toBe(
      'LAB_1_A-20260102-030405.png',
    )
  })
})

describe('LatestFrameQueue', () => {
  function flushPromises() {
    return new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  function createRecorder() {
    const drawn: string[] = []
    const dropped: string[] = []
    let finishDraw: (() => void) | undefined
    const queue = new LatestFrameQueue<string>(
      (frame) =>
        new Promise<void>((resolve) => {
          drawn.push(frame)
          finishDraw = resolve
        }),
      (frame) => {
        dropped.push(frame)
      },
    )
    return {
      queue,
      drawn,
      dropped,
      finishLastDraw: () => finishDraw?.(),
    }
  }

  it('draws a frame right away when nothing is being drawn', () => {
    const { queue, drawn } = createRecorder()
    queue.push('frame-1')
    expect(drawn).toEqual(['frame-1'])
  })

  it('keeps only the newest frame that arrives during a draw', async () => {
    const { queue, drawn, dropped, finishLastDraw } = createRecorder()
    queue.push('frame-1')
    queue.push('frame-2')
    queue.push('frame-3')
    expect(dropped).toEqual(['frame-2'])
    finishLastDraw()
    await flushPromises()
    expect(drawn).toEqual(['frame-1', 'frame-3'])
  })

  it('draws again after the queue has gone idle', async () => {
    const { queue, drawn, finishLastDraw } = createRecorder()
    queue.push('frame-1')
    finishLastDraw()
    await flushPromises()
    queue.push('frame-2')
    expect(drawn).toEqual(['frame-1', 'frame-2'])
  })
})
