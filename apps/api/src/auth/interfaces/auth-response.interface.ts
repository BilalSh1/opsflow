export interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface RegisterResponse {
  user: AuthUserResponse;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUserResponse;
}

export type RefreshResponse = LoginResponse;

// Returned by AuthService to the controller; the refresh token goes into a
// cookie and never into the response body.
export interface AuthResult {
  body: LoginResponse;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface MeResponse {
  user: AuthUserResponse;
}
