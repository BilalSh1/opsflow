export interface RegisteredUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface RegisterResponse {
  user: RegisteredUserResponse;
}
