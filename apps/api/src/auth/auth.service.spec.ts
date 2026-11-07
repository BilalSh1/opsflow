import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client';
import type {
  RefreshSessionsService,
  RefreshSessionWithUser,
} from '../refresh-sessions/refresh-sessions.service';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';
import {
  generateRefreshToken,
  hashRefreshTokenSecret,
  parseRefreshToken,
} from './refresh-token';

describe('AuthService', () => {
  let authService: AuthService;

  let usersServiceMock: jest.Mocked<
    Pick<UsersService, 'findById' | 'findByEmail' | 'create'>
  >;

  let jwtServiceMock: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  let refreshSessionsServiceMock: jest.Mocked<
    Pick<
      RefreshSessionsService,
      'create' | 'findById' | 'revoke' | 'revokeAllForUser' | 'rotate'
    >
  >;

  const registerDto: RegisterDto = {
    email: 'test@example.com',
    password: 'StrongPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };

  const user: User = {
    id: '76be9f15-77b2-4986-91cc-27154ab15b47',
    email: 'test@example.com',
    passwordHash: 'temporary-hash',
    firstName: 'Test',
    lastName: 'User',
    createdAt: new Date('2026-08-04T10:00:00.000Z'),
    updatedAt: new Date('2026-08-04T10:00:00.000Z'),
  };

  beforeEach(() => {
    usersServiceMock = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    jwtServiceMock = {
      signAsync: jest.fn(),
    };

    refreshSessionsServiceMock = {
      create: jest.fn(),
      findById: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
      rotate: jest.fn(),
    };

    authService = new AuthService(
      usersServiceMock as unknown as UsersService,
      jwtServiceMock as unknown as JwtService,
      refreshSessionsServiceMock as unknown as RefreshSessionsService,
    );
  });

  // Builds a stored session matching a freshly generated refresh token.
  const createStoredSession = (
    overrides: Partial<RefreshSessionWithUser> = {},
  ): { token: string; session: RefreshSessionWithUser } => {
    const generated = generateRefreshToken();

    return {
      token: generated.token,
      session: {
        id: generated.sessionId,
        userId: user.id,
        tokenHash: generated.tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date('2026-08-04T10:00:00.000Z'),
        updatedAt: new Date('2026-08-04T10:00:00.000Z'),
        user,
        ...overrides,
      },
    };
  };

  describe('register', () => {
    it('registers a user with a hashed password', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      usersServiceMock.create.mockImplementation((data) =>
        Promise.resolve({
          ...user,
          email: data.email,
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
        }),
      );

      const result = await authService.register(registerDto);

      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );

      expect(usersServiceMock.create).toHaveBeenCalledTimes(1);

      const createData = usersServiceMock.create.mock.calls[0][0];

      expect(createData.passwordHash).not.toBe(registerDto.password);

      await expect(
        argon2.verify(createData.passwordHash, registerDto.password),
      ).resolves.toBe(true);

      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt.toISOString(),
        },
      });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejects registration when the email already exists', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(user);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('handles a database unique-constraint conflict', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      usersServiceMock.create.mockRejectedValue({
        code: 'P2002',
      });

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('logs in a user and returns an access token', async () => {
      const password = 'StrongPassword123!';
      const hashResult: unknown = await argon2.hash(password);

      if (typeof hashResult !== 'string') {
        throw new Error('Argon2 did not return a string hash');
      }

      const passwordHash = hashResult;

      usersServiceMock.findByEmail.mockResolvedValue({
        ...user,
        passwordHash,
      });

      jwtServiceMock.signAsync.mockResolvedValue('test-access-token');

      const result = await authService.login({
        email: user.email,
        password,
      });

      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith(user.email);

      expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });

      expect(result.body).toEqual({
        accessToken: 'test-access-token',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt.toISOString(),
        },
      });

      expect(refreshSessionsServiceMock.create).toHaveBeenCalledTimes(1);

      const sessionData = refreshSessionsServiceMock.create.mock.calls[0][0];
      const parsed = parseRefreshToken(result.refreshToken);

      expect(parsed?.sessionId).toBe(sessionData.id);
      expect(sessionData.userId).toBe(user.id);
      expect(sessionData.tokenHash).toBe(
        hashRefreshTokenSecret(parsed?.secret ?? ''),
      );
      expect(sessionData.tokenHash).not.toBe(parsed?.secret);
      expect(sessionData.expiresAt).toEqual(result.refreshTokenExpiresAt);
      expect(result.refreshTokenExpiresAt.getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it('rejects login when the password is incorrect', async () => {
      const passwordHash = await argon2.hash('CorrectPassword123!');

      usersServiceMock.findByEmail.mockResolvedValue({
        ...user,
        passwordHash,
      });

      await expect(
        authService.login({
          email: user.email,
          password: 'WrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
      expect(refreshSessionsServiceMock.create).not.toHaveBeenCalled();
    });

    it('rejects login when the user does not exist', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'missing@example.com',
          password: 'StrongPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the session and returns new tokens', async () => {
      const { token, session } = createStoredSession();

      refreshSessionsServiceMock.findById.mockResolvedValue(session);
      refreshSessionsServiceMock.rotate.mockImplementation((_oldId, data) =>
        Promise.resolve({ ...session, ...data }),
      );
      jwtServiceMock.signAsync.mockResolvedValue('new-access-token');

      const result = await authService.refresh(token);

      expect(refreshSessionsServiceMock.findById).toHaveBeenCalledWith(
        session.id,
      );

      expect(refreshSessionsServiceMock.rotate).toHaveBeenCalledTimes(1);

      const [oldSessionId, newSessionData] =
        refreshSessionsServiceMock.rotate.mock.calls[0];
      const parsed = parseRefreshToken(result.refreshToken);

      expect(oldSessionId).toBe(session.id);
      expect(newSessionData.id).toBe(parsed?.sessionId);
      expect(newSessionData.id).not.toBe(session.id);
      expect(newSessionData.userId).toBe(user.id);
      expect(newSessionData.tokenHash).toBe(
        hashRefreshTokenSecret(parsed?.secret ?? ''),
      );
      expect(result.refreshToken).not.toBe(token);

      expect(result.body).toEqual({
        accessToken: 'new-access-token',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt.toISOString(),
        },
      });

      expect(
        refreshSessionsServiceMock.revokeAllForUser,
      ).not.toHaveBeenCalled();
    });

    it.each([undefined, '', 'malformed-token'])(
      'rejects a missing or malformed token %p',
      async (token) => {
        await expect(authService.refresh(token)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(refreshSessionsServiceMock.findById).not.toHaveBeenCalled();
      },
    );

    it('rejects a token for an unknown session', async () => {
      const { token } = createStoredSession();

      refreshSessionsServiceMock.findById.mockResolvedValue(null);

      await expect(authService.refresh(token)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(refreshSessionsServiceMock.rotate).not.toHaveBeenCalled();
    });

    it('rejects a wrong secret without revoking anything', async () => {
      const { session } = createStoredSession();
      const otherSecret =
        parseRefreshToken(generateRefreshToken().token)?.secret ?? '';

      refreshSessionsServiceMock.findById.mockResolvedValue(session);

      await expect(
        authService.refresh(`${session.id}.${otherSecret}`),
      ).rejects.toThrow(UnauthorizedException);

      expect(refreshSessionsServiceMock.rotate).not.toHaveBeenCalled();
      expect(
        refreshSessionsServiceMock.revokeAllForUser,
      ).not.toHaveBeenCalled();
    });

    it('rejects an expired session', async () => {
      const { token, session } = createStoredSession({
        expiresAt: new Date(Date.now() - 1000),
      });

      refreshSessionsServiceMock.findById.mockResolvedValue(session);

      await expect(authService.refresh(token)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(refreshSessionsServiceMock.rotate).not.toHaveBeenCalled();
    });

    it('revokes every session of the user when a rotated token is reused', async () => {
      const { token, session } = createStoredSession({
        revokedAt: new Date('2026-08-04T11:00:00.000Z'),
      });

      refreshSessionsServiceMock.findById.mockResolvedValue(session);

      await expect(authService.refresh(token)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(refreshSessionsServiceMock.revokeAllForUser).toHaveBeenCalledWith(
        user.id,
      );
      expect(refreshSessionsServiceMock.rotate).not.toHaveBeenCalled();
    });

    it('revokes every session of the user when it loses a rotation race', async () => {
      const { token, session } = createStoredSession();

      refreshSessionsServiceMock.findById.mockResolvedValue(session);
      refreshSessionsServiceMock.rotate.mockResolvedValue(null);

      await expect(authService.refresh(token)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(refreshSessionsServiceMock.revokeAllForUser).toHaveBeenCalledWith(
        user.id,
      );
      expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the session of a valid token', async () => {
      const { token, session } = createStoredSession();

      refreshSessionsServiceMock.findById.mockResolvedValue(session);
      refreshSessionsServiceMock.revoke.mockResolvedValue(true);

      await authService.logout(token);

      expect(refreshSessionsServiceMock.revoke).toHaveBeenCalledWith(
        session.id,
      );
    });

    it.each([undefined, 'malformed-token'])(
      'does nothing for a missing or malformed token %p',
      async (token) => {
        await expect(authService.logout(token)).resolves.toBeUndefined();

        expect(refreshSessionsServiceMock.revoke).not.toHaveBeenCalled();
      },
    );

    it('does nothing when the secret does not match', async () => {
      const { session } = createStoredSession();
      const otherSecret =
        parseRefreshToken(generateRefreshToken().token)?.secret ?? '';

      refreshSessionsServiceMock.findById.mockResolvedValue(session);

      await expect(
        authService.logout(`${session.id}.${otherSecret}`),
      ).resolves.toBeUndefined();

      expect(refreshSessionsServiceMock.revoke).not.toHaveBeenCalled();
    });

    it('does nothing for an unknown session', async () => {
      const { token } = createStoredSession();

      refreshSessionsServiceMock.findById.mockResolvedValue(null);

      await expect(authService.logout(token)).resolves.toBeUndefined();

      expect(refreshSessionsServiceMock.revoke).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns the authenticated user without the password hash', async () => {
      usersServiceMock.findById.mockResolvedValue(user);

      const result = await authService.getCurrentUser(user.id);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(user.id);

      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt.toISOString(),
        },
      });
    });

    it('rejects the request when the authenticated user no longer exists', async () => {
      usersServiceMock.findById.mockResolvedValue(null);

      await expect(authService.getCurrentUser(user.id)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
