import { createHash, randomBytes } from 'crypto';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface GeneratedInvitationToken {
  token: string;
  tokenHash: string;
}

// The token goes into the invitation link; only its hash is stored.
export function generateInvitationToken(): GeneratedInvitationToken {
  const token = randomBytes(32).toString('base64url');

  return { token, tokenHash: hashInvitationToken(token) };
}

export function isInvitationToken(value: string): boolean {
  return INVITATION_TOKEN_PATTERN.test(value);
}

// SHA-256 is sufficient because the token is 256 bits of randomness, and
// it lets the token be looked up by its hash.
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
