export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
}

export interface AuthSession {
  accessToken: string
  user: AuthUser
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput extends LoginInput {
  firstName: string
  lastName: string
}
