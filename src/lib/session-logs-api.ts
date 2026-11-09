import { z } from 'zod'
import {
  apiRequest,
  NETWORK_ERROR_MESSAGE,
  NETWORK_ERROR_STATUS,
  readErrorMessage,
  readJson,
  type ApiResult,
} from './api'
import { OK_STATUS, parseBody } from './accounts-api'
import { saveBlobAsFile } from './file-download'
import type { LogFilters } from './logs'
import {
  SESSION_LOG_END_REASONS,
  SESSION_LOG_SOURCES,
  type SessionLogPage,
} from '../types'

export const SESSION_LOG_PAGE_SIZE = 10
// The server caps an export at this many rows, newest first.
export const EXPORT_ROW_LIMIT = 10_000

const SESSION_LOG_PATH = '/api/session-logs'
const SESSION_LOG_EXPORT_PATH = '/api/session-logs/export'
const DEFAULT_EXPORT_FILENAME = 'session-logs.csv'
const TRUNCATED_HEADER = 'X-Export-Truncated'
const FILENAME_PATTERN = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i

const sessionLogSchema = z.object({
  id: z.number().int(),
  pcName: z.string(),
  userOrSource: z.string(),
  // A source this console does not know is shown as an account, since the list reads userOrSource.
  source: z.enum(SESSION_LOG_SOURCES).catch('account'),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationMinutes: z.number().int(),
  // A reason this console does not know is shown as "Other" so the rest of the page still loads.
  endReason: z.enum(SESSION_LOG_END_REASONS).nullable().catch('unknown'),
})

const sessionLogPageSchema = z.object({
  items: z.array(sessionLogSchema),
  totalItems: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

function buildFilterParams(filters: LogFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const field of ['from', 'to', 'pc', 'user'] as const) {
    const value = filters[field]?.trim() ?? ''
    if (value !== '') params.set(field, value)
  }
  return params
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString()
  return query === '' ? path : `${path}?${query}`
}

export async function listSessionLogs(
  filters: LogFilters,
  page: number,
): Promise<ApiResult<SessionLogPage>> {
  const params = buildFilterParams(filters)
  params.set('page', String(page))
  params.set('pageSize', String(SESSION_LOG_PAGE_SIZE))
  const result = await apiRequest<unknown>(withQuery(SESSION_LOG_PATH, params))
  return parseBody(result, sessionLogPageSchema, OK_STATUS)
}

// Takes the filename from Content-Disposition and keeps only its last path segment.
export function parseExportFilename(contentDisposition: string | null): string {
  const match = contentDisposition ? FILENAME_PATTERN.exec(contentDisposition) : null
  const rawName = match?.[1]
  if (!rawName) return DEFAULT_EXPORT_FILENAME
  const name = safeDecode(rawName).split(/[\\/]/).pop()?.trim() ?? ''
  return name === '' || name === '.' || name === '..' ? DEFAULT_EXPORT_FILENAME : name
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function exportSessionLogs(
  filters: LogFilters,
): Promise<ApiResult<{ isTruncated: boolean }>> {
  const url = withQuery(SESSION_LOG_EXPORT_PATH, buildFilterParams(filters))

  let response: Response
  try {
    response = await fetch(url, { credentials: 'same-origin' })
  } catch {
    return { success: false, status: NETWORK_ERROR_STATUS, error: NETWORK_ERROR_MESSAGE }
  }

  if (!response.ok) {
    const errorBody = await readJson(response)
    return { success: false, status: response.status, error: readErrorMessage(errorBody) }
  }

  let blob: Blob
  try {
    blob = await response.blob()
  } catch {
    return { success: false, status: NETWORK_ERROR_STATUS, error: NETWORK_ERROR_MESSAGE }
  }

  saveBlobAsFile(blob, parseExportFilename(response.headers.get('Content-Disposition')))
  const isTruncated = response.headers.get(TRUNCATED_HEADER)?.trim().toLowerCase() === 'true'
  return { success: true, data: { isTruncated } }
}
