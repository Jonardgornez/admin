export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: string }

export const NETWORK_ERROR_STATUS = 0
export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check that it's running."
export const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Try again.'

// A file or other blob sent as-is. The Content-Type header tells the server what the bytes are.
export interface RawBody {
  blob: Blob
  contentType: string
}

interface BaseRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  // Tells the server this request is automatic, so it doesn't extend the idle session.
  isBackground?: boolean
}

// A request sends a JSON body or a raw body, never both.
type RequestOptions = BaseRequestOptions &
  ({ body?: unknown; rawBody?: never } | { body?: never; rawBody: RawBody })

interface EncodedBody {
  contentType: string
  body: BodyInit
}

function encodeBody({ body, rawBody }: RequestOptions): EncodedBody | undefined {
  if (rawBody) return { contentType: rawBody.contentType, body: rawBody.blob }
  if (body === undefined) return undefined
  return { contentType: 'application/json', body: JSON.stringify(body) }
}

function buildHeaders(contentType: string | undefined, isBackground: boolean): Record<string, string> | undefined {
  const headers: Record<string, string> = {}
  if (contentType !== undefined) headers['Content-Type'] = contentType
  if (isBackground) headers['X-Background-Refresh'] = '1'
  return Object.keys(headers).length === 0 ? undefined : headers
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export function readErrorMessage(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const { error } = body
    if (typeof error === 'string' && error.trim() !== '') return error
  }
  return FALLBACK_ERROR_MESSAGE
}

export async function apiRequest<T = undefined>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', isBackground = false } = options
  const encoded = encodeBody(options)

  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: buildHeaders(encoded?.contentType, isBackground),
      body: encoded?.body,
    })
  } catch {
    return { success: false, status: NETWORK_ERROR_STATUS, error: NETWORK_ERROR_MESSAGE }
  }

  if (!response.ok) {
    const errorBody = await readJson(response)
    return { success: false, status: response.status, error: readErrorMessage(errorBody) }
  }

  if (response.status === 204) {
    return { success: true, data: undefined as T }
  }

  const data = await readJson(response)
  if (data === undefined) {
    return { success: false, status: response.status, error: FALLBACK_ERROR_MESSAGE }
  }
  return { success: true, data: data as T }
}
