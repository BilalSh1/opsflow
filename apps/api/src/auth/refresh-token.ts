import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { CookieOptions } from 'express';

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const REFRESH_TOKEN_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;

export interface GeneratedRefreshToken {
  sessionId: string;
  token: string;
  tokenHash: string;
}

export interface ParsedRefreshToken {
  sessionId: string;
  secret: string;
}

// Token format: "<sessionId>.<secret>". Only a hash of the secret is stored.
export function generateRefreshToken(): GeneratedRefreshToken {
  const sessionId = randomUUID();
  const secret = randomBytes(32).toString('base64url');

  return {
    sessionId,
    token: `${sessionId}.${secret}`,
    tokenHash: hashRefreshTokenSecret(secret),
  };
}

export function parseRefreshToken(
  token: string | undefined,
): ParsedRefreshToken | null {
  if (!token) {
    return null;
  }

  const match = REFRESH_TOKEN_PATTERN.exec(token);

  if (!match) {
    return null;
  }

  return {
    sessionId: match[1].toLowerCase(),
    secret: match[2],
  };
}

// SHA-256 is sufficient here because the secret is 256 bits of randomness.
export function hashRefreshTokenSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function refreshTokenSecretMatches(
  secret: string,
  tokenHash: string,
): boolean {
  const expected = Buffer.from(tokenHash, 'hex');
  const actual = Buffer.from(hashRefreshTokenSecret(secret), 'hex');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function refreshTokenCookieOptions(
  isProduction: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/api/v1/auth',
  };
}
