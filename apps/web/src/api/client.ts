import type { AuthSession } from '../types/auth'

const API_BASE = '/api/v1'
const REFRESH_LOCK = 'opsflow-refresh-session'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  // Auth endpoints opt out: a 401 there is an answer, not an expired token.
  retryOnUnauthorized?: boolean
}

// The access token lives only in memory; the refresh token is an httpOnly
// cookie the browser sends to /api/v1/auth.
let accessToken: string | null = null
let refreshInFlight: Promise<AuthSession | null> | null = null
const sessionExpiredListeners = new Set<() => void>()

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener)

  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { retryOnUnauthorized = true } = options
  const sentWithToken = accessToken !== null

  let response = await send(path, options)

  if (response.status === 401 && retryOnUnauthorized && sentWithToken) {
    const session = await refreshSession()

    if (!session) {
      sessionExpiredListeners.forEach((listener) => listener())
      throw await toApiError(response)
    }

    response = await send(path, options)
  }

  if (!response.ok) {
    throw await toApiError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

// Every caller shares one request, and tabs take turns through a Web Lock.
// The API revokes all sessions when a refresh token is used twice, so two
// parallel refreshes would log the user out everywhere.
export function refreshSession(): Promise<AuthSession | null> {
  refreshInFlight ??= runExclusive(async () => {
    const response = await send('/auth/refresh', { method: 'POST' })

    if (!response.ok) {
      accessToken = null
      return null
    }

    const session = (await response.json()) as AuthSession
    accessToken = session.accessToken

    return session
  }).finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

function send(path: string, options: RequestOptions): Promise<Response> {
  const headers = new Headers()

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  return fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
  })
}

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK, task)
  }

  return task()
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`

  try {
    const body = (await response.json()) as { message?: unknown }

    if (typeof body.message === 'string') {
      message = body.message
    } else if (Array.isArray(body.message)) {
      message = body.message.join('. ')
    }
  } catch {
    // Keep the generic message when the body is not JSON.
  }

  return new ApiError(response.status, message)
}
