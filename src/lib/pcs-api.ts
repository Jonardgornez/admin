import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { approvalChoiceSchema, OK_STATUS, parseBody } from './accounts-api'
import type { ServerPc } from '../types'

const bulkCommandResultSchema = z.object({ affected: z.number().int().nonnegative() })

export type BulkCommandResult = z.infer<typeof bulkCommandResultSchema>

const serverPcSessionSchema = z.object({
  username: z.string().nullable(),
  startedAt: z.string(),
  time: approvalChoiceSchema,
  secondsRemaining: z.number().nullable(),
})

const serverPcSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  isOnline: z.boolean(),
  isLocked: z.boolean(),
  ipAddress: z.string().nullable(),
  registeredAt: z.string(),
  lastSeenAt: z.string(),
  session: serverPcSessionSchema.nullable(),
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

// The server reads no body for these commands, but the JSON body keeps them POST requests.
const COMMAND_BODY = {}

export function lockPc(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/pcs/${id}/lock`, { method: 'POST', body: COMMAND_BODY })
}

export function unlockPc(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/pcs/${id}/unlock`, { method: 'POST', body: COMMAND_BODY })
}

export async function lockAllPcs(): Promise<ApiResult<BulkCommandResult>> {
  return parseBody(
    await apiRequest<unknown>('/api/pcs/lock-all', { method: 'POST', body: COMMAND_BODY }),
    bulkCommandResultSchema,
    OK_STATUS,
  )
}

export async function unlockAllPcs(): Promise<ApiResult<BulkCommandResult>> {
  return parseBody(
    await apiRequest<unknown>('/api/pcs/unlock-all', { method: 'POST', body: COMMAND_BODY }),
    bulkCommandResultSchema,
    OK_STATUS,
  )
}
