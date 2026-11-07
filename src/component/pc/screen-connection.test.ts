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

  receive(data: string) {
    this.emit('message', { data })
  }

  private emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function openTestConnection() {
  const onServerState = vi.fn()
  const onControlMessage = vi.fn()
  const onClose = vi.fn()
  const connection = openScreenConnection({
    url: 'ws://test.local/api/pcs/1/screen/live?mode=notified',
    getCanvas: () => null,
    onServerState,
    onControlMessage,
    onFrameDrawn: vi.fn(),
    onClose,
  })
  const socket = FakeWebSocket.instances[0]
  return { connection, socket, onServerState, onControlMessage, onClose }
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

  it('still passes stream states to onServerState and not to onControlMessage', () => {
    const { socket, onServerState, onControlMessage } = openTestConnection()
    socket.open()
    socket.receive('{"state":"live"}')
    expect(onServerState).toHaveBeenCalledWith('live')
    expect(onControlMessage).not.toHaveBeenCalled()
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
