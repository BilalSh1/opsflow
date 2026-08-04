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
