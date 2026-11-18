import type { FileTransfer } from '../types'

export function makeTransfer(id: number, overrides: Partial<FileTransfer> = {}): FileTransfer {
  return {
    id,
    pcId: id,
    pcName: `PC-${id}`,
    fileName: 'notes.pdf',
    sizeBytes: 1024,
    folder: 'desktop',
    subfolder: 'Lykantra Share',
    status: 'waiting',
    decision: null,
    savedAs: null,
    error: null,
    createdUtc: '2026-11-18T10:00:00Z',
    updatedUtc: '2026-11-18T10:00:00Z',
    ...overrides,
  }
}
