import { z } from 'zod'
import { parseBody, OK_STATUS } from './accounts-api'
import { apiRequest, type ApiResult } from './api'

const DELIVERY_STATUSES = ['delivered', 'failed', 'offline', 'not-found', 'busy'] as const

export type PcMessageStatus = (typeof DELIVERY_STATUSES)[number]

const pcMessageDeliverySchema = z.object({
  pcId: z.number().int(),
  pcName: z.string(),
  status: z.enum(DELIVERY_STATUSES),
})

const sendMessageResponseSchema = z.object({
  results: z.array(pcMessageDeliverySchema),
})

export type PcMessageDelivery = z.infer<typeof pcMessageDeliverySchema>

// The server waits up to 6 seconds for each PC to confirm, so this request can take a while.
export async function sendPcMessage(
  pcIds: number[],
  text: string,
): Promise<ApiResult<PcMessageDelivery[]>> {
  const result = await parseBody(
    await apiRequest<unknown>('/api/pcs/messages', {
      method: 'POST',
      body: { pcIds, text },
    }),
    sendMessageResponseSchema,
    OK_STATUS,
  )
  if (!result.success) return result
  return { success: true, data: result.data.results }
}
