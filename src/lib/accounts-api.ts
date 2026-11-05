import { z } from 'zod'
import { apiRequest, FALLBACK_ERROR_MESSAGE, type ApiResult } from './api'
import type { Account } from '../types'

const accountSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  isActive: z.boolean(),
  defaultTime: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('time-limit'), minutes: z.number().int() }),
    z.object({ mode: z.literal('open-time') }),
  ]),
  lastLoginAt: z.string().nullable(),
})

const accountListSchema = z.array(accountSchema)

const OK_STATUS = 200
const CREATED_STATUS = 201

export interface AccountPayload {
  username: string
  password?: string
  defaultTime: Account['defaultTime']
}

// Keeps only the fields the schema names, so anything extra the server sends is dropped.
function parseBody<T>(
  result: ApiResult<unknown>,
  schema: z.ZodType<T>,
  successStatus: number,
): ApiResult<T> {
  if (!result.success) return result
  const parsed = schema.safeParse(result.data)
  if (parsed.success) return { success: true, data: parsed.data }
  return { success: false, status: successStatus, error: FALLBACK_ERROR_MESSAGE }
}

async function requestAccount(
  path: string,
  options: Parameters<typeof apiRequest>[1],
  successStatus = OK_STATUS,
): Promise<ApiResult<Account>> {
  return parseBody(await apiRequest<unknown>(path, options), accountSchema, successStatus)
}

export async function listAccounts(): Promise<ApiResult<Account[]>> {
  return parseBody(await apiRequest<unknown>('/api/accounts'), accountListSchema, OK_STATUS)
}

export function createAccount(payload: AccountPayload): Promise<ApiResult<Account>> {
  return requestAccount('/api/accounts', { method: 'POST', body: payload }, CREATED_STATUS)
}

export function updateAccount(id: number, payload: AccountPayload): Promise<ApiResult<Account>> {
  return requestAccount(`/api/accounts/${id}`, { method: 'PUT', body: payload })
}

export function setAccountActive(id: number, isActive: boolean): Promise<ApiResult<Account>> {
  return requestAccount(`/api/accounts/${id}/status`, { method: 'PATCH', body: { isActive } })
}

export function deleteAccount(id: number): Promise<ApiResult<undefined>> {
  return apiRequest(`/api/accounts/${id}`, { method: 'DELETE' })
}
