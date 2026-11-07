import {
  generateRefreshToken,
  hashRefreshTokenSecret,
  parseRefreshToken,
  refreshTokenCookieOptions,
  refreshTokenSecretMatches,
} from './refresh-token';

describe('refresh token helpers', () => {
  it('generates a token that parses back to its session id and secret', () => {
    const generated = generateRefreshToken();

    const parsed = parseRefreshToken(generated.token);

    expect(parsed).not.toBeNull();
    expect(parsed?.sessionId).toBe(generated.sessionId);
    expect(generated.tokenHash).toBe(
      hashRefreshTokenSecret(parsed?.secret ?? ''),
    );
  });

  it('never stores the raw secret as the hash', () => {
    const generated = generateRefreshToken();
    const parsed = parseRefreshToken(generated.token);

    expect(generated.tokenHash).not.toBe(parsed?.secret);
    expect(generated.token).not.toContain(generated.tokenHash);
  });

  it('generates a different token every time', () => {
    expect(generateRefreshToken().token).not.toBe(generateRefreshToken().token);
  });

  it.each([
    undefined,
    '',
    'not-a-token',
    'a5f4b18.secret',
    '76be9f15-77b2-4986-91cc-27154ab15b47',
    '76be9f15-77b2-4986-91cc-27154ab15b47.short',
    '76be9f15-77b2-4986-91cc-27154ab15b47.' + 'a'.repeat(43) + '.extra',
  ])('rejects malformed token %p', (token) => {
    expect(parseRefreshToken(token)).toBeNull();
  });

  it('matches only the correct secret', () => {
    const generated = generateRefreshToken();
    const secret = parseRefreshToken(generated.token)?.secret ?? '';
    const otherSecret =
      parseRefreshToken(generateRefreshToken().token)?.secret ?? '';

    expect(refreshTokenSecretMatches(secret, generated.tokenHash)).toBe(true);
    expect(refreshTokenSecretMatches(otherSecret, generated.tokenHash)).toBe(
      false,
    );
    expect(refreshTokenSecretMatches(secret, 'not-hex')).toBe(false);
  });

  it('builds httpOnly, strict cookies scoped to the auth routes', () => {
    expect(refreshTokenCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/api/v1/auth',
    });

    expect(refreshTokenCookieOptions(true).secure).toBe(true);
  });
});
