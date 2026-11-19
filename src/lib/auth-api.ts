import { apiRequest, type ApiResult } from './api'

export interface AdminSession {
  username: string
}

export function signIn(username: string, password: string): Promise<ApiResult<AdminSession>> {
  return apiRequest<AdminSession>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
}

export function signOut(): Promise<ApiResult<undefined>> {
  // Sent as JSON so a plain cross-page form can't sign the admin out.
  return apiRequest('/api/auth/logout', { method: 'POST', body: {} })
}

export function getCurrentAdmin(): Promise<ApiResult<AdminSession>> {
  return apiRequest<AdminSession>('/api/auth/me')
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ApiResult<undefined>> {
  return apiRequest('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  })
}
