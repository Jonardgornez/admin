import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { approvalChoiceSchema, OK_STATUS, parseBody } from './accounts-api'
import { clientUpdateStatusSchema, clientVersionSchema } from './client-update-schema'
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
  // An older server omits these fields, so they default to the state of a PC with no block.
  internetBlocked: z.boolean().default(false),
  internetBlockApplied: z.boolean().nullable().default(null),
  // Read per PC: an older server omits these, and one odd value must not hide the whole Dashboard.
  clientVersion: clientVersionSchema.nullable().catch(null),
  clientUpdate: clientUpdateStatusSchema.nullable().catch(null),
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

// The server takes at most this many PCs in one command, so larger selections are sent in batches.
export const PC_COMMAND_BATCH_SIZE = 500

function chunkPcIds(pcIds: number[]): number[][] {
  const batches: number[][] = []
  for (let start = 0; start < pcIds.length; start += PC_COMMAND_BATCH_SIZE) {
    batches.push(pcIds.slice(start, start + PC_COMMAND_BATCH_SIZE))
  }
  return batches
}

// Sends each batch in turn and adds up what the server affected. The first failure stops the rest.
async function sendPcBatches(
  pcIds: number[],
  sendBatch: (batch: number[]) => Promise<ApiResult<BulkCommandResult>>,
): Promise<ApiResult<BulkCommandResult>> {
  let affected = 0
  for (const batch of chunkPcIds(pcIds)) {
    const result = await sendBatch(batch)
    if (!result.success) return result
    affected += result.data.affected
  }
  return { success: true, data: { affected } }
}

// Queues the update for these PCs. The version is the one the admin saw, so a changed upload is refused.
export function queuePcsClientUpdate(
  pcIds: number[],
  version: string,
): Promise<ApiResult<BulkCommandResult>> {
  return sendPcBatches(pcIds, (batch) =>
    postPcIdsCommand('/api/pcs/client-update', { pcIds: batch, version }),
  )
}

export function cancelPcsClientUpdate(pcIds: number[]): Promise<ApiResult<BulkCommandResult>> {
  return sendPcBatches(pcIds, (batch) =>
    postPcIdsCommand('/api/pcs/client-update/cancel', { pcIds: batch }),
  )
}

async function postPcIdsCommand(
  path: string,
  body: { pcIds: number[]; version?: string },
): Promise<ApiResult<BulkCommandResult>> {
  return parseBody(
    await apiRequest<unknown>(path, { method: 'POST', body }),
    bulkCommandResultSchema,
    OK_STATUS,
  )
}
