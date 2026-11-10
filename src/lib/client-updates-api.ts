import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'
import { clientVersionSchema, getClientInstallerFileError } from './client-update-schema'
import type { ClientRelease } from '../types'

const BAD_REQUEST_STATUS = 400
const OCTET_STREAM_TYPE = 'application/octet-stream'

const releaseSchema = z.object({
  version: clientVersionSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAtUtc: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
})

const releaseResponseSchema = z.object({
  release: releaseSchema.nullable(),
})

export async function getClientRelease(): Promise<ApiResult<ClientRelease | null>> {
  const result = await parseBody(
    await apiRequest<unknown>('/api/client-updates'),
    releaseResponseSchema,
    OK_STATUS,
  )
  if (!result.success) return result
  return { success: true, data: result.data.release }
}

// The installer goes up as its own bytes. The server reads the version from the file itself.
export async function uploadClientRelease(file: File): Promise<ApiResult<ClientRelease>> {
  const fileError = getClientInstallerFileError(file)
  if (fileError) return { success: false, status: BAD_REQUEST_STATUS, error: fileError }

  const result = await apiRequest<unknown>('/api/client-updates', {
    method: 'PUT',
    rawBody: { blob: file, contentType: OCTET_STREAM_TYPE },
  })
  return parseBody(result, releaseSchema, OK_STATUS)
}

export function removeClientRelease(): Promise<ApiResult<undefined>> {
  return apiRequest('/api/client-updates', { method: 'DELETE' })
}
