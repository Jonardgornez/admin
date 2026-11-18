import { useEffect, useRef, useState } from 'react'
import {
  ALREADY_PASTING_MESSAGE,
  buildTextMessage,
  PASTE_CHUNK_INTERVAL_MS,
  PASTE_NEEDS_CONTROL_MESSAGE,
  preparePasteText,
  type PasteOutcome,
} from '../../lib/paste-text'

export type PasteTextResult = { success: true } | { success: false; error: string }

interface UsePasteTextOptions {
  // False while control is off. Turning it off stops a paste that is being typed.
  isEnabled: boolean
  sendMessage: (message: string) => boolean
}

export interface PasteTextSender {
  // Null while nothing is being typed.
  progressPercent: number | null
  // How the last paste ended. Null before any paste and while one is typing.
  outcome: PasteOutcome | null
  pasteText: (text: string) => PasteTextResult
  stopPaste: () => void
}

interface PasteRun {
  chunks: string[]
  nextIndex: number
  sentLength: number
  totalLength: number
  timeoutId: number | null
}

// Sends one paste at a time as text chunks, paced under the server's rate limit.
export function usePasteText({ isEnabled, sendMessage }: UsePasteTextOptions): PasteTextSender {
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const [outcome, setOutcome] = useState<PasteOutcome | null>(null)
  const runRef = useRef<PasteRun | null>(null)

  function endRun(runOutcome: PasteOutcome) {
    const run = runRef.current
    if (!run) return
    if (run.timeoutId !== null) window.clearTimeout(run.timeoutId)
    runRef.current = null
    setProgressPercent(null)
    setOutcome(runOutcome)
  }

  function stopPaste() {
    endRun('stopped')
  }

  // Control off (which includes a closed socket) and unmount both stop the paste.
  useEffect(() => {
    if (!isEnabled) return
    return () => stopPaste()
  }, [isEnabled])

  function sendNextChunk(run: PasteRun) {
    run.timeoutId = null
    if (runRef.current !== run) return
    const chunk = run.chunks[run.nextIndex]
    const message = buildTextMessage(chunk)
    if (message === null || !sendMessage(message)) {
      endRun('stopped')
      return
    }
    run.nextIndex += 1
    run.sentLength += chunk.length
    if (run.nextIndex >= run.chunks.length) {
      endRun('typed')
      return
    }
    setProgressPercent(Math.floor((run.sentLength / run.totalLength) * 100))
    run.timeoutId = window.setTimeout(() => sendNextChunk(run), PASTE_CHUNK_INTERVAL_MS)
  }

  function pasteText(text: string): PasteTextResult {
    if (!isEnabled) return { success: false, error: PASTE_NEEDS_CONTROL_MESSAGE }
    if (runRef.current) return { success: false, error: ALREADY_PASTING_MESSAGE }
    const prepared = preparePasteText(text)
    if (!prepared.success) return prepared
    const run: PasteRun = {
      chunks: prepared.chunks,
      nextIndex: 0,
      sentLength: 0,
      totalLength: prepared.chunks.reduce((total, chunk) => total + chunk.length, 0),
      timeoutId: null,
    }
    runRef.current = run
    setProgressPercent(0)
    setOutcome(null)
    sendNextChunk(run)
    return { success: true }
  }

  return { progressPercent, outcome, pasteText, stopPaste }
}
