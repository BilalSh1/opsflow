import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { RegisterDto } from './dto/register.dto';
import type { RegisterResponse } from './interfaces/auth-response.interface';

describe('AuthController', () => {
  let authController: AuthController;
  let registerMock: jest.MockedFunction<AuthService['register']>;

  beforeEach(() => {
    registerMock = jest.fn();

    const authServiceMock = {
      register: registerMock,
    } as Pick<AuthService, 'register'>;

    authController = new AuthController(authServiceMock as AuthService);
  });

  it('delegates registration to AuthService', async () => {
    const dto: RegisterDto = {
      email: 'test@example.com',
      password: 'StrongPassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    const response: RegisterResponse = {
      user: {
        id: '76be9f15-77b2-4986-91cc-27154ab15b47',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        createdAt: '2026-08-04T10:00:00.000Z',
      },
    };

    registerMock.mockResolvedValue(response);

    const result = await authController.register(dto);

    expect(result).toEqual(response);
    expect(registerMock).toHaveBeenCalledWith(dto);
  });
});
