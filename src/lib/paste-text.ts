// Text pasted into the controlled PC is sent as {"t":"text","s":chunk} messages that the PC types.

// Counted in UTF-16 code units after normalization, as the server and the PC count them.
export const MAX_PASTE_LENGTH = 10_000
export const PASTE_CHUNK_LENGTH = 64
// 12.5 chunks a second, well under the server's cap on text messages.
export const PASTE_CHUNK_INTERVAL_MS = 80
// Screen readers hear the progress only at these steps, not on every chunk.
const PASTE_ANNOUNCE_STEP_PERCENT = 25

export const PASTE_TOO_LONG_MESSAGE = `The text is too long. Paste at most ${MAX_PASTE_LENGTH.toLocaleString('en-US')} characters.`
export const NOTHING_TO_PASTE_MESSAGE = 'Nothing to paste — the clipboard has no text.'
export const ALREADY_PASTING_MESSAGE =
  'Text is already being typed on the PC. Wait for it to finish or press Stop.'
export const PASTE_NEEDS_CONTROL_MESSAGE = 'Take control of the PC before pasting text.'

const LINE_BREAK = /\r\n?/g
// Control characters other than newline and tab (C0, DEL, C1) and unpaired surrogates can't be typed.
const UNTYPABLE_CHARACTER = /(?![\n\t])[\p{Cc}\p{Cs}]/u
const UNTYPABLE_CHARACTERS = new RegExp(UNTYPABLE_CHARACTER.source, 'gu')

// How the last paste ended: every chunk was sent, or it stopped early.
export type PasteOutcome = 'typed' | 'stopped'

export type PreparedPaste = { success: true; chunks: string[] } | { success: false; error: string }

export interface PasteShortcutKeyEvent {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff
}

// Line breaks become "\n". Other untypable characters are dropped silently rather than refusing
// the paste, because ordinary clipboard text (from terminals, PDFs, web pages) often has a stray one.
export function normalizePasteText(text: string): string {
  return text.replace(LINE_BREAK, '\n').replace(UNTYPABLE_CHARACTERS, '')
}

// Chunks of at most 64 UTF-16 code units. A chunk never ends between the two halves of a surrogate pair.
export function splitPasteText(text: string): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + PASTE_CHUNK_LENGTH, text.length)
    if (end < text.length && isHighSurrogate(text.charCodeAt(end - 1))) end -= 1
    chunks.push(text.slice(start, end))
    start = end
  }
  return chunks
}

export function isTypableChunk(chunk: string): boolean {
  return (
    chunk.length > 0 && chunk.length <= PASTE_CHUNK_LENGTH && !UNTYPABLE_CHARACTER.test(chunk)
  )
}

// Null for a chunk the server would drop, so nothing invalid is ever sent.
export function buildTextMessage(chunk: string): string | null {
  if (!isTypableChunk(chunk)) return null
  return JSON.stringify({ t: 'text', s: chunk })
}

// Normalizes and checks the whole paste before anything is sent, so a refused paste sends nothing.
export function preparePasteText(text: string): PreparedPaste {
  const normalized = normalizePasteText(text)
  if (normalized === '') return { success: false, error: NOTHING_TO_PASTE_MESSAGE }
  if (normalized.length > MAX_PASTE_LENGTH) return { success: false, error: PASTE_TOO_LONG_MESSAGE }
  return { success: true, chunks: splitPasteText(normalized) }
}

// Ctrl+V (Cmd+V on a Mac, Ctrl+Shift+V included) and Shift+Insert. The browser turns these into
// a paste event, so their key presses are never sent to the PC.
export function isPasteShortcut(event: PasteShortcutKeyEvent): boolean {
  if (event.altKey) return false
  if (event.code === 'KeyV') return event.ctrlKey || event.metaKey
  return event.code === 'Insert' && event.shiftKey && !event.ctrlKey && !event.metaKey
}

// "Typing…" at the start, then 25%, 50% and 75%, then how it ended. Empty before any paste.
export function getPasteAnnouncement(
  progressPercent: number | null,
  outcome: PasteOutcome | null,
): string {
  if (progressPercent !== null) {
    const step =
      Math.floor(progressPercent / PASTE_ANNOUNCE_STEP_PERCENT) * PASTE_ANNOUNCE_STEP_PERCENT
    return step === 0 ? 'Typing…' : `Typing… ${Math.min(step, 100 - PASTE_ANNOUNCE_STEP_PERCENT)}%`
  }
  if (outcome === 'typed') return 'Typed on the PC.'
  if (outcome === 'stopped') return 'Stopped.'
  return ''
}
