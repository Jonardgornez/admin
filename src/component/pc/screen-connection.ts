import {
  LatestFrameQueue,
  parseScreenStateMessage,
  type ScreenSize,
  type ServerScreenState,
} from '../../lib/screen-stream'

const ACK_MESSAGE = 'ack'
const FRAME_MIME_TYPE = 'image/jpeg'
const NORMAL_CLOSE_CODE = 1000

export interface ScreenConnectionOptions {
  url: string
  getCanvas: () => HTMLCanvasElement | null
  onServerState: (state: ServerScreenState) => void
  // Called only when the frame size changes.
  onFrameDrawn: (size: ScreenSize) => void
  // wasOpen is false when the server refused the upgrade (for example 401, 403, 404 or 409).
  onClose: (code: number, wasOpen: boolean) => void
}

export interface ScreenConnection {
  close: () => void
}

async function decodeFrame(frame: ArrayBuffer): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(new Blob([frame], { type: FRAME_MIME_TYPE }))
  } catch {
    return null
  }
}

// Opens one screen socket. Each binary frame is drawn once, then acknowledged. A frame that
// fails to decode is still acknowledged so the stream never stalls.
export function openScreenConnection(options: ScreenConnectionOptions): ScreenConnection {
  const socket = new WebSocket(options.url)
  socket.binaryType = 'arraybuffer'
  let wasOpen = false
  let isClosed = false
  let lastSize: ScreenSize | null = null

  function acknowledge() {
    if (socket.readyState === WebSocket.OPEN) socket.send(ACK_MESSAGE)
  }

  function paintBitmap(bitmap: ImageBitmap) {
    const canvas = options.getCanvas()
    if (!canvas) return
    // Resizing a canvas clears it, so only resize when the frame size really changes.
    if (canvas.width !== bitmap.width) canvas.width = bitmap.width
    if (canvas.height !== bitmap.height) canvas.height = bitmap.height
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    // Reported only on a size change, so the page does not re-render for every frame.
    if (lastSize?.width !== bitmap.width || lastSize?.height !== bitmap.height) {
      lastSize = { width: bitmap.width, height: bitmap.height }
      options.onFrameDrawn(lastSize)
    }
  }

  async function drawFrame(frame: ArrayBuffer) {
    const bitmap = await decodeFrame(frame)
    if (bitmap) {
      if (!isClosed) paintBitmap(bitmap)
      bitmap.close()
    }
    acknowledge()
  }

  const frames = new LatestFrameQueue<ArrayBuffer>(drawFrame, acknowledge)

  socket.addEventListener('open', () => {
    wasOpen = true
  })

  socket.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (typeof event.data === 'string') {
      const state = parseScreenStateMessage(event.data)
      if (state) options.onServerState(state)
      return
    }
    if (event.data instanceof ArrayBuffer) frames.push(event.data)
  })

  socket.addEventListener('close', (event: CloseEvent) => {
    if (isClosed) return
    isClosed = true
    options.onClose(event.code, wasOpen)
  })

  return {
    close() {
      if (isClosed) return
      isClosed = true
      socket.close(NORMAL_CLOSE_CODE)
    },
  }
}
