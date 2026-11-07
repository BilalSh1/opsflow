import { describe, expect, it, vi } from 'vitest'
import { json, mockFetch, noContent, session, unauthorized } from '../test/fetch-mock'
import {
  ApiError,
  apiRequest,
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from './client'

describe('apiRequest', () => {
  it('sends the access token and cookies', async () => {
    const { calls, fetchMock } = mockFetch(() => json(200, { ok: true }))
    setAccessToken('access-token')

    await expect(apiRequest('/things')).resolves.toEqual({ ok: true })

    expect(calls[0]).toMatchObject({
      path: '/things',
      method: 'GET',
      authorization: 'Bearer access-token',
    })
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })

  it('refreshes once and retries with the new token after a 401', async () => {
    const { calls } = mockFetch((call) => {
      if (call.path === '/auth/refresh') {
        return json(200, session('new-token'))
      }

      return call.authorization === 'Bearer new-token'
        ? json(200, { ok: true })
        : unauthorized('Invalid or expired access token')
    })
    setAccessToken('expired-token')

    await expect(apiRequest('/things')).resolves.toEqual({ ok: true })

    expect(calls.map((call) => call.path)).toEqual([
      '/things',
      '/auth/refresh',
      '/things',
    ])
  })

  it('reports an expired session when the refresh fails', async () => {
    mockFetch(() => unauthorized())
    const listener = vi.fn()
    const unsubscribe = onSessionExpired(listener)
    setAccessToken('expired-token')

    await expect(apiRequest('/things')).rejects.toMatchObject({ status: 401 })

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('does not refresh when the request opts out', async () => {
    const { calls } = mockFetch(() => unauthorized('Invalid email or password'))
    setAccessToken('some-token')

    await expect(
      apiRequest('/auth/login', { method: 'POST', retryOnUnauthorized: false }),
    ).rejects.toThrow('Invalid email or password')

    expect(calls).toHaveLength(1)
  })

  it('joins validation messages into one error message', async () => {
    mockFetch(() =>
      json(400, {
        message: ['email must be an email', 'password is too short'],
        error: 'Bad Request',
        statusCode: 400,
      }),
    )

    const error = await apiRequest('/auth/register', {
      method: 'POST',
      body: {},
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe(
      'email must be an email. password is too short',
    )
  })

  it('returns undefined for 204 responses', async () => {
    mockFetch(() => noContent())

    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })
})

describe('refreshSession', () => {
  it('shares one request between concurrent callers', async () => {
    const { calls } = mockFetch(() => json(200, session('new-token')))

    const results = await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ])

    expect(calls).toHaveLength(1)
    expect(results.every((result) => result?.accessToken === 'new-token')).toBe(true)
  })

  it('returns null when there is no valid session', async () => {
    mockFetch(() => unauthorized())

    await expect(refreshSession()).resolves.toBeNull()
  })
})
