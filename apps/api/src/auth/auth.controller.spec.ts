import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type {
  AuthResult,
  RegisterResponse,
} from './interfaces/auth-response.interface';

describe('AuthController', () => {
  let authController: AuthController;
  let registerMock: jest.MockedFunction<AuthService['register']>;
  let loginMock: jest.MockedFunction<AuthService['login']>;
  let refreshMock: jest.MockedFunction<AuthService['refresh']>;
  let logoutMock: jest.MockedFunction<AuthService['logout']>;

  let responseMock: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };

  const userResponse = {
    id: '76be9f15-77b2-4986-91cc-27154ab15b47',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    createdAt: '2026-08-04T10:00:00.000Z',
  };

  const authResult: AuthResult = {
    body: {
      accessToken: 'test-access-token',
      user: userResponse,
    },
    refreshToken: 'test-refresh-token',
    refreshTokenExpiresAt: new Date('2026-08-11T10:00:00.000Z'),
  };

  const expectedCookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    path: '/api/v1/auth',
  };

  const requestWithCookie = (token?: string): Request =>
    ({
      cookies: token ? { refresh_token: token } : {},
    }) as unknown as Request;

  beforeEach(() => {
    registerMock = jest.fn();
    loginMock = jest.fn();
    refreshMock = jest.fn();
    logoutMock = jest.fn();

    const authServiceMock = {
      register: registerMock,
      login: loginMock,
      refresh: refreshMock,
      logout: logoutMock,
    } as Pick<AuthService, 'register' | 'login' | 'refresh' | 'logout'>;

    const configServiceMock = {
      get: jest.fn().mockReturnValue('development'),
    } as unknown as ConfigService;

    responseMock = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    authController = new AuthController(
      authServiceMock as AuthService,
      configServiceMock,
    );
  });

  it('delegates registration to AuthService', async () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'StrongPassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    const response: RegisterResponse = {
      user: userResponse,
    };

    registerMock.mockResolvedValue(response);

    const result = await authController.register(dto);

    expect(result).toEqual(response);
    expect(registerMock).toHaveBeenCalledWith(dto);
  });

  it('sets the refresh token cookie on login and keeps it out of the body', async () => {
    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'StrongPassword123!',
    };

    loginMock.mockResolvedValue(authResult);

    const result = await authController.login(
      dto,
      responseMock as unknown as Response,
    );

    expect(loginMock).toHaveBeenCalledWith(dto);

    expect(responseMock.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'test-refresh-token',
      {
        ...expectedCookieOptions,
        expires: authResult.refreshTokenExpiresAt,
      },
    );

    expect(result).toEqual(authResult.body);
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('refreshes using the cookie and sets the rotated cookie', async () => {
    refreshMock.mockResolvedValue(authResult);

    const result = await authController.refresh(
      requestWithCookie('old-refresh-token'),
      responseMock as unknown as Response,
    );

    expect(refreshMock).toHaveBeenCalledWith('old-refresh-token');

    expect(responseMock.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'test-refresh-token',
      {
        ...expectedCookieOptions,
        expires: authResult.refreshTokenExpiresAt,
      },
    );

    expect(result).toEqual(authResult.body);
  });

  it('passes undefined to AuthService when the refresh cookie is missing', async () => {
    refreshMock.mockResolvedValue(authResult);

    await authController.refresh(
      requestWithCookie(),
      responseMock as unknown as Response,
    );

    expect(refreshMock).toHaveBeenCalledWith(undefined);
  });

  it('revokes the session and clears the cookie on logout', async () => {
    logoutMock.mockResolvedValue(undefined);

    await authController.logout(
      requestWithCookie('current-refresh-token'),
      responseMock as unknown as Response,
    );

    expect(logoutMock).toHaveBeenCalledWith('current-refresh-token');

    expect(responseMock.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expectedCookieOptions,
    );
  });
});
