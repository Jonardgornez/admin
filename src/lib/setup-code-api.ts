import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'

// Six groups of four characters from the base32 alphabet (A-Z, 2-7).
export const SETUP_CODE_PATTERN = /^[A-Z2-7]{4}(-[A-Z2-7]{4}){5}$/

const setupCodeSchema = z.object({
  code: z.string().regex(SETUP_CODE_PATTERN),
})

export interface SetupCode {
  code: string
}

export async function getSetupCode(): Promise<ApiResult<SetupCode>> {
  return parseBody(await apiRequest<unknown>('/api/pcs/setup-code'), setupCodeSchema, OK_STATUS)
}

export async function regenerateSetupCode(): Promise<ApiResult<SetupCode>> {
  return parseBody(
    await apiRequest<unknown>('/api/pcs/setup-code/regenerate', { method: 'POST', body: {} }),
    setupCodeSchema,
    OK_STATUS,
  )
}
