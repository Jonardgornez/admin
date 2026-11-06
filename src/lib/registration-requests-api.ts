import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'

const registrationRequestSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  ipAddress: z.string().nullable(),
  pairingNumber: z.string().regex(/^\d{6}$/),
  requestedAt: z.string(),
})

const registrationRequestListSchema = z.object({
  requests: z.array(registrationRequestSchema),
})

export type RegistrationRequest = z.infer<typeof registrationRequestSchema>

interface ListRegistrationRequestsOptions {
  isBackground: boolean
}

export async function listRegistrationRequests({
  isBackground,
}: ListRegistrationRequestsOptions): Promise<ApiResult<RegistrationRequest[]>> {
  const result = parseBody(
    await apiRequest<unknown>('/api/registration-requests', { isBackground }),
    registrationRequestListSchema,
    OK_STATUS,
  )
  return result.success ? { success: true, data: result.data.requests } : result
}

export function acceptRegistrationRequest(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/registration-requests/${id}/accept`, { method: 'POST', body: {} })
}

export function denyRegistrationRequest(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/registration-requests/${id}/deny`, { method: 'POST', body: {} })
}
