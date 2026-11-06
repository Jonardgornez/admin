import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'

const serverInfoSchema = z.object({
  primaryAddress: z.string().nullable(),
  otherAddresses: z.array(z.string()),
  clientPort: z.number().int(),
  adminPort: z.number().int(),
})

export type ServerInfo = z.infer<typeof serverInfoSchema>

export async function getServerInfo(): Promise<ApiResult<ServerInfo>> {
  return parseBody(await apiRequest<unknown>('/api/server-info'), serverInfoSchema, OK_STATUS)
}
