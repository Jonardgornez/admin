import { z } from 'zod'
import {
  apiRequest,
  FALLBACK_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  NETWORK_ERROR_STATUS,
  readErrorMessage,
  type ApiResult,
} from './api'
import { OK_STATUS, parseBody } from './accounts-api'
import { toUploadPercent } from './file-transfers'
import {
  FILE_TRANSFER_DECISIONS,
  FILE_TRANSFER_STATUSES,
  FILE_TRANSFER_WAITING_REASONS,
  SHARE_FOLDERS,
  type FileTransfer,
  type FileTransferDecision,
  type SharedFile,
  type ShareFolder,
} from '../types'

const CREATED_STATUS = 201
export const UPLOAD_CANCELLED_MESSAGE = 'Upload cancelled.'

const sharedFileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})

const fileTransferSchema = z.object({
  id: z.number().int(),
  pcId: z.number().int(),
  pcName: z.string(),
  fileName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  folder: z.enum(SHARE_FOLDERS),
  subfolder: z.string(),
  status: z.enum(FILE_TRANSFER_STATUSES),
  decision: z.enum(FILE_TRANSFER_DECISIONS).nullable(),
  savedAs: z.string().nullable(),
  error: z.string().nullable(),
  waitingReason: z.enum(FILE_TRANSFER_WAITING_REASONS).nullable(),
  busyWith: z.string().nullable(),
  pcClientVersion: z.string().nullable(),
  createdUtc: z.string(),
  updatedUtc: z.string(),
})

const transfersResponseSchema = z.object({
  transfers: z.array(fileTransferSchema),
})

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function readUploadResult(request: XMLHttpRequest): ApiResult<SharedFile> {
  const body = parseJson(request.responseText)
  if (request.status < 200 || request.status >= 300) {
    return { success: false, status: request.status, error: readErrorMessage(body) }
  }
  const parsed = sharedFileSchema.safeParse(body)
  if (parsed.success) return { success: true, data: parsed.data }
  return { success: false, status: CREATED_STATUS, error: FALLBACK_ERROR_MESSAGE }
}

interface UploadSharedFileOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

// XMLHttpRequest is used because fetch can't report upload progress. The bytes go up as the raw body,
// with the original name in a header, and the same-origin session cookie goes with it as for fetch.
export function uploadSharedFile(
  file: File,
  { onProgress, signal }: UploadSharedFileOptions = {},
): Promise<ApiResult<SharedFile>> {
  const cancelled: ApiResult<SharedFile> = {
    success: false,
    status: NETWORK_ERROR_STATUS,
    error: UPLOAD_CANCELLED_MESSAGE,
  }
  if (signal?.aborted) return Promise.resolve(cancelled)

  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    const abortRequest = () => request.abort()

    function finish(result: ApiResult<SharedFile>) {
      signal?.removeEventListener('abort', abortRequest)
      resolve(result)
    }

    request.open('POST', '/api/shared-files')
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    request.upload.onprogress = (event) => {
      onProgress?.(toUploadPercent(event.loaded, event.lengthComputable ? event.total : file.size))
    }
    request.onload = () => finish(readUploadResult(request))
    request.onerror = () =>
      finish({ success: false, status: NETWORK_ERROR_STATUS, error: NETWORK_ERROR_MESSAGE })
    request.onabort = () => finish(cancelled)
    signal?.addEventListener('abort', abortRequest)
    request.send(file)
  })
}

interface SendFilePayload {
  ids: number[]
  sharedFileId: number
  folder: ShareFolder
  subfolder: string
}

function readTransfers(result: ApiResult<unknown>): ApiResult<FileTransfer[]> {
  const parsed = parseBody(result, transfersResponseSchema, OK_STATUS)
  if (!parsed.success) return parsed
  return { success: true, data: parsed.data.transfers }
}

export async function sendFileToPcs(payload: SendFilePayload): Promise<ApiResult<FileTransfer[]>> {
  return readTransfers(
    await apiRequest<unknown>('/api/pcs/files', { method: 'POST', body: payload }),
  )
}

interface GetFileTransfersOptions {
  isBackground?: boolean
}

export async function getFileTransfers(
  transferIds: number[],
  { isBackground = false }: GetFileTransfersOptions = {},
): Promise<ApiResult<FileTransfer[]>> {
  // The ids are whole numbers, so the comma list needs no escaping.
  return readTransfers(
    await apiRequest<unknown>(`/api/pcs/files/transfers?ids=${transferIds.join(',')}`, {
      isBackground,
    }),
  )
}

export async function decideFileTransfers(
  transferIds: number[],
  decision: FileTransferDecision,
): Promise<ApiResult<FileTransfer[]>> {
  return readTransfers(
    await apiRequest<unknown>('/api/pcs/files/transfers/decision', {
      method: 'POST',
      body: { transferIds, decision },
    }),
  )
}

export async function cancelFileTransfers(transferIds: number[]): Promise<ApiResult<FileTransfer[]>> {
  return readTransfers(
    await apiRequest<unknown>('/api/pcs/files/transfers/cancel', {
      method: 'POST',
      body: { transferIds },
    }),
  )
}
