import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client';
import { RefreshSessionsService } from '../refresh-sessions/refresh-sessions.service';
import { UsersService } from '../users/users.service';
import type {
  LoginInput,
  RegisterInput,
} from './interfaces/auth-input.interface';
import type { AccessTokenPayload } from './interfaces/access-token-payload.interface';
import type {
  AuthResult,
  AuthUserResponse,
  RegisterResponse,
  MeResponse,
} from './interfaces/auth-response.interface';
import {
  generateRefreshToken,
  parseRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  refreshTokenSecretMatches,
} from './refresh-token';

const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid or expired refresh token';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshSessionsService: RefreshSessionsService,
  ) {}

  async register(registerDto: RegisterInput): Promise<RegisterResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(registerDto.password);

    try {
      const user = await this.usersService.create({
        email: registerDto.email,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });

      return {
        user: this.toUserResponse(user),
      };
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async login(loginDto: LoginInput): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      loginDto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.signAccessToken(user);
    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = this.refreshTokenExpiresAt();

    await this.refreshSessionsService.create({
      id: refreshToken.sessionId,
      userId: user.id,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshTokenExpiresAt,
    });

    return {
      body: {
        accessToken,
        user: this.toUserResponse(user),
      },
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt,
    };
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthResult> {
    const parsed = parseRefreshToken(rawRefreshToken);

    if (!parsed) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const session = await this.refreshSessionsService.findById(
      parsed.sessionId,
    );

    // A wrong secret revokes nothing, so knowing a session id is not enough
    // to log someone out.
    if (
      !session ||
      !refreshTokenSecretMatches(parsed.secret, session.tokenHash)
    ) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    // A valid token for a revoked session was already rotated and may have
    // been stolen, so every session of this user is ended.
    if (session.revokedAt) {
      await this.refreshSessionsService.revokeAllForUser(session.userId);
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const refreshToken = generateRefreshToken();
    const refreshTokenExpiresAt = this.refreshTokenExpiresAt();

    const rotated = await this.refreshSessionsService.rotate(session.id, {
      id: refreshToken.sessionId,
      userId: session.userId,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshTokenExpiresAt,
    });

    // Another request rotated this session first; treat it like reuse.
    if (!rotated) {
      await this.refreshSessionsService.revokeAllForUser(session.userId);
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    return {
      body: {
        accessToken: await this.signAccessToken(session.user),
        user: this.toUserResponse(session.user),
      },
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt,
    };
  }

  // Idempotent: a missing or invalid token is ignored rather than reported.
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    const parsed = parseRefreshToken(rawRefreshToken);

    if (!parsed) {
      return;
    }

    const session = await this.refreshSessionsService.findById(
      parsed.sessionId,
    );

    if (
      !session ||
      !refreshTokenSecretMatches(parsed.secret, session.tokenHash)
    ) {
      return;
    }

    await this.refreshSessionsService.revoke(session.id);
  }

  async getCurrentUser(userId: string): Promise<MeResponse> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    return {
      user: this.toUserResponse(user),
    };
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
    };

    const tokenResult: unknown =
      await this.jwtService.signAsync<AccessTokenPayload>(payload);

    if (typeof tokenResult !== 'string') {
      throw new Error('Failed to generate access token');
    }

    return tokenResult;
  }

  private refreshTokenExpiresAt(): Date {
    return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  }

  private toUserResponse(user: User): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    return 'code' in error && error.code === 'P2002';
  }
}
