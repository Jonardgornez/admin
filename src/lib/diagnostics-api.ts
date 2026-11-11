import { z } from 'zod'
import { apiRequest, type ApiResult } from './api'
import { OK_STATUS, parseBody } from './accounts-api'
import { clientVersionSchema } from './client-update-schema'
import { DIAGNOSTICS_EVENT_LEVELS, DIAGNOSTICS_UPDATE_STATES, type PcDiagnostics } from '../types'

// The server answers 404 with this message until the PC's service sends its first report.
export const NO_REPORT_STATUS = 404
export const NO_REPORT_MESSAGE = 'No report from this PC yet.'

const diagnosticsUpdateSchema = z.object({
  version: clientVersionSchema,
  state: z.enum(DIAGNOSTICS_UPDATE_STATES),
  error: z.string().nullable(),
})

const diagnosticsEventSchema = z.object({
  at: z.string(),
  level: z.enum(DIAGNOSTICS_EVENT_LEVELS),
  message: z.string(),
})

const pcDiagnosticsSchema = z.object({
  receivedAt: z.string(),
  serviceVersion: clientVersionSchema,
  clientRunning: z.boolean(),
  clientVersion: clientVersionSchema.nullable(),
  userSignedIn: z.boolean(),
  update: diagnosticsUpdateSchema.nullable(),
  events: z.array(diagnosticsEventSchema),
})

interface GetPcDiagnosticsOptions {
  isBackground?: boolean
}

export async function getPcDiagnostics(
  pcId: number,
  { isBackground = false }: GetPcDiagnosticsOptions = {},
): Promise<ApiResult<PcDiagnostics>> {
  return parseBody(
    await apiRequest<unknown>(`/api/pcs/${pcId}/diagnostics`, { isBackground }),
    pcDiagnosticsSchema,
    OK_STATUS,
  )
}
