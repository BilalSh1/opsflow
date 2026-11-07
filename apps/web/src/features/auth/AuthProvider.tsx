import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../../api/auth'
import { onSessionExpired, refreshSession } from '../../api/client'
import type { AuthUser, LoginInput, RegisterInput } from '../../types/auth'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
}

const signedOut: AuthState = { status: 'unauthenticated', user: null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
  })

  // Restore the session from the refresh-token cookie on startup.
  useEffect(() => {
    let active = true

    refreshSession()
      .catch(() => null)
      .then((session) => {
        if (active) {
          setState(
            session
              ? { status: 'authenticated', user: session.user }
              : signedOut,
          )
        }
      })

    const unsubscribe = onSessionExpired(() => setState(signedOut))

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const session = await authApi.login(input)
    setState({ status: 'authenticated', user: session.user })
  }, [])

  const register = useCallback(
    async (input: RegisterInput) => {
      await authApi.register(input)
      await login({ email: input.email, password: input.password })
    },
    [login],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setState(signedOut)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
