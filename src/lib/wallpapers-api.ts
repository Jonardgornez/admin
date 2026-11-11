import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'
import { getBackgroundFileError } from './background-schema'

const BAD_REQUEST_STATUS = 400

const wallpaperUploadSchema = z.object({
  id: z.number().int(),
  sha256: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
})

export type WallpaperUpload = z.infer<typeof wallpaperUploadSchema>

// The same PNG and JPEG rules as the screen backgrounds apply, so the check is shared.
// The file goes up as its own bytes, so the Content-Type header carries its image type.
export async function uploadWallpaper(file: File): Promise<ApiResult<WallpaperUpload>> {
  const fileError = getBackgroundFileError(file)
  if (fileError) return { success: false, status: BAD_REQUEST_STATUS, error: fileError }

  const result = await apiRequest<unknown>('/api/wallpapers', {
    method: 'POST',
    rawBody: { blob: file, contentType: file.type },
  })
  return parseBody(result, wallpaperUploadSchema, OK_STATUS)
}
