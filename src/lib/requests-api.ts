import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { approvalChoiceSchema, OK_STATUS, parseBody } from './accounts-api'
import {
  LOGIN_REQUEST_REASONS,
  type ApprovalChoice,
  type LoginRequest,
} from '../types'

const loginRequestSchema = z.object({
  id: z.number().int(),
  pcName: z.string(),
  requestedAt: z.string(),
  status: z.enum(['pending', 'approved', 'denied', 'cancelled']),
  time: approvalChoiceSchema.optional(),
  decidedAt: z.string().nullable(),
  // A reason this console does not know is dropped, so the rest of the list still loads.
  reason: z.enum(LOGIN_REQUEST_REASONS).optional().catch(undefined),
})

const loginRequestListsSchema = z.object({
  pending: z.array(loginRequestSchema),
  history: z.array(loginRequestSchema),
})

const deniedListSchema = z.object({ denied: z.array(loginRequestSchema) })

export interface LoginRequestLists {
  pending: LoginRequest[]
  history: LoginRequest[]
}

interface ListLoginRequestsOptions {
  isBackground?: boolean
}

export async function listLoginRequests({
  isBackground = false,
}: ListLoginRequestsOptions = {}): Promise<ApiResult<LoginRequestLists>> {
  return parseBody(
    await apiRequest<unknown>('/api/login-requests', { isBackground }),
    loginRequestListsSchema,
    OK_STATUS,
  )
}

async function requestDecision(
  id: number,
  action: 'approve' | 'deny',
  body: { time: ApprovalChoice } | Record<string, never>,
): Promise<ApiResult<LoginRequest>> {
  const result = await apiRequest<unknown>(`/api/login-requests/${id}/${action}`, {
    method: 'POST',
    body,
  })
  return parseBody(result, loginRequestSchema, OK_STATUS)
}

export function approveLoginRequest(
  id: number,
  time: ApprovalChoice,
): Promise<ApiResult<LoginRequest>> {
  return requestDecision(id, 'approve', { time })
}

export function denyLoginRequest(id: number): Promise<ApiResult<LoginRequest>> {
  // The server requires a JSON body here so that a cross-origin form can't forge a denial.
  return requestDecision(id, 'deny', {})
}

export async function denyLoginRequests(ids: number[]): Promise<ApiResult<LoginRequest[]>> {
  const result = await apiRequest<unknown>('/api/login-requests/deny-all', {
    method: 'POST',
    body: { ids },
  })
  const parsed = parseBody(result, deniedListSchema, OK_STATUS)
  return parsed.success ? { success: true, data: parsed.data.denied } : parsed
}
