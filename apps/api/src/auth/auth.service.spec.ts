import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let authService: AuthService;

  let usersServiceMock: jest.Mocked<
    Pick<UsersService, 'findByEmail' | 'create'>
  >;

  let jwtServiceMock: jest.Mocked<Pick<JwtService, 'signAsync'>>;

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
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    jwtServiceMock = {
      signAsync: jest.fn(),
    };

    authService = new AuthService(
      usersServiceMock as unknown as UsersService,
      jwtServiceMock as unknown as JwtService,
    );
  });

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
      const passwordHash = await argon2.hash(password);

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

      expect(result).toEqual({
        accessToken: 'test-access-token',
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
});
