import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { approvalChoiceSchema, OK_STATUS, parseBody } from './accounts-api'
import type { PcTimeCommand, ServerPc } from '../types'

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
  shutdownState: z
    .enum(['shutting-down', 'shutdown', 'restarting', 'rebooting', 'cancelling'])
    .nullable(),
  isServerPc: z.boolean(),
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

export function editPcTime(id: number, command: PcTimeCommand): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/pcs/${id}/time`, { method: 'POST', body: command })
}

export function shutDownPc(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/pcs/${id}/shutdown`, { method: 'POST', body: COMMAND_BODY })
}

export function rebootPc(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/pcs/${id}/reboot`, { method: 'POST', body: COMMAND_BODY })
}

export function cancelPcPower(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/pcs/${id}/cancel-power`, { method: 'POST', body: COMMAND_BODY })
}

async function postBulkCommand(
  path: string,
  ids: number[],
): Promise<ApiResult<BulkCommandResult>> {
  return parseBody(
    await apiRequest<unknown>(path, { method: 'POST', body: { ids } }),
    bulkCommandResultSchema,
    OK_STATUS,
  )
}

export function bulkLockPcs(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/lock', ids)
}

export function bulkUnlockPcs(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/unlock', ids)
}

export function bulkShutDownPcs(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/shutdown', ids)
}

export function bulkRebootPcs(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/reboot', ids)
}

export function cancelPcsPower(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/cancel-power', ids)
}
