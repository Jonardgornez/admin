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

const serverPcWallpaperSchema = z.object({
  id: z.number().int(),
  sha256: z.string(),
})

const serverPcServiceSchema = z.object({
  lastSeenAt: z.string(),
  clientRunning: z.boolean(),
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
  // An older server omits this, so a missing or odd value reads as no wallpaper.
  wallpaper: serverPcWallpaperSchema.nullable().catch(null),
  // An older server omits this, so a missing or odd value reads as no service report.
  service: serverPcServiceSchema.nullable().catch(null),
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

// A null message locks with the default message from Settings.
export function lockPc(id: number, message: string | null): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/pcs/${id}/lock`, { method: 'POST', body: { message } })
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

async function postBulkCommand(path: string, body: object): Promise<ApiResult<BulkCommandResult>> {
  return parseBody(
    await apiRequest<unknown>(path, { method: 'POST', body }),
    bulkCommandResultSchema,
    OK_STATUS,
  )
}

// A null message locks with the default message from Settings.
export function bulkLockPcs(
  ids: number[],
  message: string | null,
): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/lock', { ids, message })
}

export function bulkUnlockPcs(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/unlock', { ids })
}

export function bulkShutDownPcs(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/shutdown', { ids })
}

export function bulkRebootPcs(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/reboot', { ids })
}

export function cancelPcsPower(ids: number[]): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/cancel-power', { ids })
}

// The same change goes to every PC. The server skips PCs with no session, and counts the ones it changed.
export function editPcsTime(
  ids: number[],
  command: PcTimeCommand,
): Promise<ApiResult<BulkCommandResult>> {
  return postBulkCommand('/api/pcs/time', { ids, ...command })
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
// installNow signs a PC in use out after a warning, instead of waiting for it to be free.
export function queuePcsClientUpdate(
  pcIds: number[],
  version: string,
  installNow: boolean,
): Promise<ApiResult<BulkCommandResult>> {
  return sendPcBatches(pcIds, (batch) =>
    postPcIdsCommand('/api/pcs/client-update', { pcIds: batch, version, installNow }),
  )
}

// Sets the wallpaper on these PCs, or removes it with null. The server takes the id of an uploaded image.
export function setPcsWallpaper(
  pcIds: number[],
  wallpaperId: number | null,
): Promise<ApiResult<BulkCommandResult>> {
  return sendPcBatches(pcIds, (batch) =>
    postBulkCommand('/api/pcs/wallpaper', { ids: batch, wallpaperId }),
  )
}

export function cancelPcsClientUpdate(pcIds: number[]): Promise<ApiResult<BulkCommandResult>> {
  return sendPcBatches(pcIds, (batch) =>
    postPcIdsCommand('/api/pcs/client-update/cancel', { pcIds: batch }),
  )
}

async function postPcIdsCommand(
  path: string,
  body: { pcIds: number[]; version?: string; installNow?: boolean },
): Promise<ApiResult<BulkCommandResult>> {
  return parseBody(
    await apiRequest<unknown>(path, { method: 'POST', body }),
    bulkCommandResultSchema,
    OK_STATUS,
  )
}
