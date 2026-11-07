import { vi } from 'vitest'
import type { AuthSession } from '../types/auth'

export interface FetchCall {
  path: string
  method: string
  authorization: string | null
  body: unknown
}

type Handler = (call: FetchCall) => Response | Promise<Response>

// Replaces fetch for one test; `calls` records every request made.
export function mockFetch(handler: Handler) {
  const calls: FetchCall[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const call: FetchCall = {
      path: String(input).replace(/^\/api\/v1/, ''),
      method: init?.method ?? 'GET',
      authorization: headers.get('Authorization'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }

    calls.push(call)

    return handler(call)
  })

  vi.stubGlobal('fetch', fetchMock)

  return { calls, fetchMock }
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export function unauthorized(message = 'Invalid or expired refresh token'): Response {
  return json(401, { message, error: 'Unauthorized', statusCode: 401 })
}

export const testUser = {
  id: '76be9f15-77b2-4986-91cc-27154ab15b47',
  email: 'ada@example.test',
  firstName: 'Ada',
  lastName: 'Lovelace',
  createdAt: '2026-11-07T10:00:00.000Z',
}

export function session(accessToken = 'access-token'): AuthSession {
  return { accessToken, user: testUser }
}
