import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openScreenConnection } from './screen-connection'

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.CONNECTING
  binaryType = 'blob'
  readonly url: string
  readonly sent: string[] = []
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>()

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code = 1000) {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', { code })
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.emit('open', {})
  }

  receive(data: string | ArrayBuffer) {
    this.emit('message', { data })
  }

  private emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function openTestConnection(ackDelayMs?: number) {
  const onServerState = vi.fn()
  const onControlMessage = vi.fn()
  const onCursorMessage = vi.fn()
  const onClose = vi.fn()
  const connection = openScreenConnection({
    url: 'ws://test.local/api/pcs/1/screen/live?mode=notified',
    getCanvas: () => null,
    onServerState,
    onControlMessage,
    onCursorMessage,
    onFrameDrawn: vi.fn(),
    onClose,
    ackDelayMs,
  })
  const socket = FakeWebSocket.instances[0]
  return { connection, socket, onServerState, onControlMessage, onCursorMessage, onClose }
}

describe('openScreenConnection', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends nothing until the socket is open', () => {
    const { connection, socket } = openTestConnection()
    expect(connection.send('{"t":"release"}')).toBe(false)
    socket.open()
    expect(connection.send('{"t":"release"}')).toBe(true)
    expect(socket.sent).toEqual(['{"t":"release"}'])
  })

  it('stops sending once the socket has closed', () => {
    const { connection, socket } = openTestConnection()
    socket.open()
    socket.close(1006)
    expect(connection.send('{"t":"release"}')).toBe(false)
    expect(socket.sent).toEqual([])
  })

  it('passes control messages to onControlMessage and not to onServerState', () => {
    const { socket, onServerState, onControlMessage } = openTestConnection()
    socket.open()
    socket.receive('{"control":"on"}')
    expect(onControlMessage).toHaveBeenCalledWith({ control: 'on' })
    expect(onServerState).not.toHaveBeenCalled()
  })

  it('passes cursor messages to onCursorMessage only', () => {
    const { socket, onServerState, onControlMessage, onCursorMessage } = openTestConnection()
    socket.open()
    socket.receive('{"cursor":"text"}')
    expect(onCursorMessage).toHaveBeenCalledWith({ cursor: 'text' })
    expect(onServerState).not.toHaveBeenCalled()
    expect(onControlMessage).not.toHaveBeenCalled()
  })

  it('drops an invalid cursor message', () => {
    const { socket, onCursorMessage } = openTestConnection()
    socket.open()
    socket.receive('{"cursor":"url(evil)"}')
    expect(onCursorMessage).not.toHaveBeenCalled()
  })

  it('still passes stream states to onServerState and not to onControlMessage', () => {
    const { socket, onServerState, onControlMessage } = openTestConnection()
    socket.open()
    socket.receive('{"state":"live"}')
    expect(onServerState).toHaveBeenCalledWith('live')
    expect(onControlMessage).not.toHaveBeenCalled()
  })

  it('passes the secure state to onServerState', () => {
    const { socket, onServerState } = openTestConnection()
    socket.open()
    socket.receive('{"state":"secure"}')
    expect(onServerState).toHaveBeenCalledWith('secure')
  })

  it('keeps decoding and acknowledging frames after the secure state', async () => {
    const decode = vi.fn(() => Promise.resolve({ width: 4, height: 3, close: vi.fn() }))
    vi.stubGlobal('createImageBitmap', decode)
    const { socket } = openTestConnection()
    socket.open()
    socket.receive('{"state":"secure"}')

    socket.receive(new ArrayBuffer(8))

    await vi.waitFor(() => expect(socket.sent).toEqual(['ack']))
    expect(decode).toHaveBeenCalledTimes(1)
  })

  it('ignores text that is neither a state nor a control message', () => {
    const { socket, onServerState, onControlMessage } = openTestConnection()
    socket.open()
    socket.receive('hello')
    expect(onServerState).not.toHaveBeenCalled()
    expect(onControlMessage).not.toHaveBeenCalled()
  })

  it('reports a refused upgrade as never opened', () => {
    const { socket, onClose } = openTestConnection()
    socket.close(1006)
    expect(onClose).toHaveBeenCalledWith(1006, false)
  })
})

describe('openScreenConnection ack delay', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({ width: 4, height: 3, close: vi.fn() })),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('acks a drawn frame at once when no delay is set', async () => {
    const { socket } = openTestConnection()
    socket.open()

    socket.receive(new ArrayBuffer(8))
    await vi.advanceTimersByTimeAsync(0)

    expect(socket.sent).toEqual(['ack'])
  })

  it('holds the ack until the delay has passed since the frame arrived', async () => {
    const { socket } = openTestConnection(1000)
    socket.open()

    socket.receive(new ArrayBuffer(8))
    await vi.advanceTimersByTimeAsync(999)
    expect(socket.sent).toEqual([])

    await vi.advanceTimersByTimeAsync(1)
    expect(socket.sent).toEqual(['ack'])
  })

  it('spaces the acks of frames that arrive together by the delay', async () => {
    const { socket } = openTestConnection(1000)
    socket.open()

    socket.receive(new ArrayBuffer(8))
    await vi.advanceTimersByTimeAsync(10)
    socket.receive(new ArrayBuffer(8))
    await vi.advanceTimersByTimeAsync(990)
    expect(socket.sent).toEqual(['ack'])

    await vi.advanceTimersByTimeAsync(999)
    expect(socket.sent).toEqual(['ack'])
    await vi.advanceTimersByTimeAsync(1)
    expect(socket.sent).toEqual(['ack', 'ack'])
  })

  it('sends no held ack after the connection is closed', async () => {
    const { connection, socket } = openTestConnection(1000)
    socket.open()
    socket.receive(new ArrayBuffer(8))
    await vi.advanceTimersByTimeAsync(500)

    connection.close()
    // The fake socket counts as open again, so only the cancelled timer keeps the ack from going out.
    socket.readyState = FakeWebSocket.OPEN
    await vi.advanceTimersByTimeAsync(2000)

    expect(socket.sent).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sends no held ack after the server closes the socket', async () => {
    const { socket } = openTestConnection(1000)
    socket.open()
    socket.receive(new ArrayBuffer(8))
    await vi.advanceTimersByTimeAsync(500)

    socket.close(1006)
    await vi.advanceTimersByTimeAsync(2000)

    expect(socket.sent).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('schedules no ack for a frame whose drawing ends after close', async () => {
    let finishDecoding: (bitmap: { width: number; height: number; close: () => void }) => void =
      () => undefined
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => new Promise((resolve) => (finishDecoding = resolve))),
    )
    const { connection, socket } = openTestConnection(1000)
    socket.open()
    socket.receive(new ArrayBuffer(8))

    connection.close()
    socket.readyState = FakeWebSocket.OPEN
    finishDecoding({ width: 4, height: 3, close: vi.fn() })
    await vi.advanceTimersByTimeAsync(0)

    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(socket.sent).toEqual([])
  })
})

