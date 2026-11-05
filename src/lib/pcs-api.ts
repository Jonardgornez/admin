import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'
import type { ServerPc } from '../types'

const serverPcSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  isOnline: z.boolean(),
  ipAddress: z.string().nullable(),
  registeredAt: z.string(),
  lastSeenAt: z.string(),
})

const serverPcListSchema = z.array(serverPcSchema)

interface ListPcsOptions {
  isBackground?: boolean
}

export async function listPcs({ isBackground = false }: ListPcsOptions = {}): Promise<
  ApiResult<ServerPc[]>
> {
  return parseBody(
    await apiRequest<unknown>('/api/pcs', { isBackground }),
    serverPcListSchema,
    OK_STATUS,
  )
}

export function removePc(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/pcs/${id}`, { method: 'DELETE' })
}
