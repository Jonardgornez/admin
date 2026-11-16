import { z } from 'zod'
import { OK_STATUS, parseBody } from './accounts-api'
import { apiRequest, type ApiResult } from './api'

const UNINSTALL_PASSWORD_PATH = '/api/settings/uninstall-password'

const uninstallPasswordStatusSchema = z.object({
  isSet: z.boolean(),
})

export type UninstallPasswordStatus = z.infer<typeof uninstallPasswordStatusSchema>

async function putUninstallPassword(
  password: string | null,
): Promise<ApiResult<UninstallPasswordStatus>> {
  const result = await apiRequest<unknown>(UNINSTALL_PASSWORD_PATH, {
    method: 'PUT',
    body: { password },
  })
  return parseBody(result, uninstallPasswordStatusSchema, OK_STATUS)
}

export async function getUninstallPasswordStatus(): Promise<ApiResult<UninstallPasswordStatus>> {
  return parseBody(
    await apiRequest<unknown>(UNINSTALL_PASSWORD_PATH),
    uninstallPasswordStatusSchema,
    OK_STATUS,
  )
}

export function setUninstallPassword(password: string): Promise<ApiResult<UninstallPasswordStatus>> {
  return putUninstallPassword(password)
}

export function clearUninstallPassword(): Promise<ApiResult<UninstallPasswordStatus>> {
  return putUninstallPassword(null)
}
