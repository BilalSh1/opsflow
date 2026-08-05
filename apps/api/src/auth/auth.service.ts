import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client';
import { UsersService } from '../users/users.service';
import type {
  LoginInput,
  RegisterInput,
} from './interfaces/auth-input.interface';
import type { AccessTokenPayload } from './interfaces/access-token-payload.interface';
import type {
  AuthUserResponse,
  LoginResponse,
  RegisterResponse,
  MeResponse,
} from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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

  async login(loginDto: LoginInput): Promise<LoginResponse> {
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

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
    };

    const tokenResult: unknown =
      await this.jwtService.signAsync<AccessTokenPayload>(payload);

    if (typeof tokenResult !== 'string') {
      throw new Error('Failed to generate access token');
    }

    const accessToken = tokenResult;

    return {
      accessToken,
      user: this.toUserResponse(user),
    };
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
