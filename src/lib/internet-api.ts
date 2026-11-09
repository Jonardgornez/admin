import { z } from 'zod'
import { parseBody, OK_STATUS } from './accounts-api'
import { apiRequest, type ApiResult } from './api'

const INTERNET_RESULT_STATUSES = ['ok', 'not-found', 'server-pc'] as const

export type InternetResultStatus = (typeof INTERNET_RESULT_STATUSES)[number]

// The server has no name for a PC that no longer exists (not-found), so it sends null there.
const internetResultSchema = z
  .object({
    pcId: z.number().int(),
    pcName: z.string().nullable(),
    result: z.enum(INTERNET_RESULT_STATUSES),
  })
  .transform((internetResult) => ({
    ...internetResult,
    pcName: internetResult.pcName ?? `PC #${internetResult.pcId}`,
  }))

const setInternetResponseSchema = z.object({
  results: z.array(internetResultSchema),
})

export type InternetResult = z.infer<typeof internetResultSchema>

export async function setPcsInternetBlocked(
  pcIds: number[],
  blocked: boolean,
): Promise<ApiResult<InternetResult[]>> {
  const result = await parseBody(
    await apiRequest<unknown>('/api/pcs/internet', {
      method: 'POST',
      body: { pcIds, blocked },
    }),
    setInternetResponseSchema,
    OK_STATUS,
  )
  if (!result.success) return result
  return { success: true, data: result.data.results }
}
