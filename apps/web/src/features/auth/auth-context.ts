import { createContext } from 'react'
import type { AuthUser, LoginInput, RegisterInput } from '../../types/auth'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  // True after the user logged out themselves (as opposed to an expired
  // session), so the next login does not return to their last page.
  loggedOut: boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
