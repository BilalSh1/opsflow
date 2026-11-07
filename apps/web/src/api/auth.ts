import type {
  AuthSession,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '../types/auth'
import { apiRequest, setAccessToken } from './client'

export async function login(input: LoginInput): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/auth/login', {
    method: 'POST',
    body: input,
    retryOnUnauthorized: false,
  })

  setAccessToken(session.accessToken)

  return session
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const { user } = await apiRequest<{ user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: input,
    retryOnUnauthorized: false,
  })

  return user
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>('/auth/logout', {
      method: 'POST',
      retryOnUnauthorized: false,
    })
  } finally {
    setAccessToken(null)
  }
}
