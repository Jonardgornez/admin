import type { LoginRequest } from '../types'

export const LOGIN_REQUEST_LIST_PATH = '/api/login-requests'
export const BACKGROUND_HEADERS = { 'X-Background-Refresh': '1' }

export function makeLoginRequest(id: number, overrides: Partial<LoginRequest> = {}): LoginRequest {
  return {
    id,
    pcName: `PC-${String(id).padStart(2, '0')}`,
    requestedAt: '2026-11-05T10:00:00.000Z',
    status: 'pending',
    decidedAt: null,
    ...overrides,
  }
}

export function loginRequestListsBody(pending: LoginRequest[], history: LoginRequest[] = []) {
  return { pending, history }
}
