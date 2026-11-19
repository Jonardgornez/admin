import { useEffect, useEffectEvent, useRef, type RefObject } from 'react'
import { cursorToCss } from '../../lib/remote-cursor'
import type { RemoteControlState } from '../../lib/remote-control'
import type { ScreenSocketEvent, ScreenStream } from './use-screen-stream'

interface UseRemoteCursorOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  controlKind: RemoteControlState['kind']
  subscribe: ScreenStream['subscribe']
}

const NORMAL_CURSOR = ''

// Mirrors the PC's pointer shape on the screen canvas while control is on. The style is set
// directly on the canvas, so a new shape never re-renders the page.
export function useRemoteCursor({ canvasRef, controlKind, subscribe }: UseRemoteCursorOptions) {
  const isOn = controlKind === 'on'
  const isOff = controlKind === 'off'
  // The PC's first shape can arrive right after "control on", before React has rendered the
  // on state. It is kept here and applied once control is on.
  const latestCursorRef = useRef<string | null>(null)

  const handleSocketEvent = useEffectEvent((event: ScreenSocketEvent) => {
    if (event.kind === 'closed') {
      latestCursorRef.current = null
      if (canvasRef.current) canvasRef.current.style.cursor = NORMAL_CURSOR
      return
    }
    if (event.kind !== 'cursor' || isOff) return
    const cursor = cursorToCss(event.message)
    latestCursorRef.current = cursor
    if (isOn && canvasRef.current) canvasRef.current.style.cursor = cursor
  })

  useEffect(() => subscribe((event) => handleSocketEvent(event)), [subscribe])

  useEffect(() => {
    if (isOff) latestCursorRef.current = null
  }, [isOff])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!isOn || !canvas) return
    if (latestCursorRef.current) canvas.style.cursor = latestCursorRef.current
    return () => {
      canvas.style.cursor = NORMAL_CURSOR
    }
  }, [isOn, canvasRef])
}
