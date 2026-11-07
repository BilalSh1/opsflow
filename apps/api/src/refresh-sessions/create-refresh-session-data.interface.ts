export interface CreateRefreshSessionData {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}
