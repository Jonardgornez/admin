import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'
import { getBackgroundFileError } from './background-schema'
import { BACKGROUND_KINDS, type BackgroundKind } from './backgrounds'

const BAD_REQUEST_STATUS = 400

const backgroundKindSchema = z.enum(BACKGROUND_KINDS)

const backgroundInfoSchema = z.object({
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  updatedAtUtc: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
})

const backgroundSetSchema = z.object({
  login: backgroundInfoSchema.nullable(),
  lock: backgroundInfoSchema.nullable(),
})

export type BackgroundInfo = z.infer<typeof backgroundInfoSchema>

export type BackgroundSet = z.infer<typeof backgroundSetSchema>

// The kind goes into the URL path, so it is checked at runtime too, not only by its type.
function backgroundPath(kind: BackgroundKind): string {
  return `/api/backgrounds/${backgroundKindSchema.parse(kind)}`
}

export function getBackgrounds(): Promise<ApiResult<BackgroundSet>> {
  return apiRequest<unknown>('/api/backgrounds').then((result) =>
    parseBody(result, backgroundSetSchema, OK_STATUS),
  )
}

// The file goes up as its own bytes, so the Content-Type header carries its image type.
export async function uploadBackground(
  kind: BackgroundKind,
  file: File,
): Promise<ApiResult<BackgroundInfo>> {
  const fileError = getBackgroundFileError(file)
  if (fileError) return { success: false, status: BAD_REQUEST_STATUS, error: fileError }

  const result = await apiRequest<unknown>(backgroundPath(kind), {
    method: 'PUT',
    rawBody: { blob: file, contentType: file.type },
  })
  return parseBody(result, backgroundInfoSchema, OK_STATUS)
}

export function removeBackground(kind: BackgroundKind): Promise<ApiResult<undefined>> {
  return apiRequest(backgroundPath(kind), { method: 'DELETE' })
}

// The hash in the query changes whenever the image does, so the browser never shows an old copy.
export function backgroundImageUrl(kind: BackgroundKind, sha256: string): string {
  return `${backgroundPath(kind)}/image?v=${encodeURIComponent(sha256)}`
}
