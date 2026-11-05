export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: string }

export const NETWORK_ERROR_STATUS = 0
export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check that it's running."
export const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Try again.'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function readErrorMessage(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const { error } = body
    if (typeof error === 'string' && error.trim() !== '') return error
  }
  return FALLBACK_ERROR_MESSAGE
}

export async function apiRequest<T = undefined>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
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
