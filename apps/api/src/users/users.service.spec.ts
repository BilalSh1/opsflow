import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const user: User = {
    id: '76be9f15-77b2-4986-91cc-27154ab15b47',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
  };

  const findUniqueMock = jest.fn((): Promise<User | null> =>
    Promise.resolve(user),
  );

  const createMock = jest.fn((): Promise<User> => Promise.resolve(user));

  const prismaMock = {
    user: {
      findUnique: findUniqueMock,
      create: createMock,
    },
  } as unknown as PrismaService;

  let usersService: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    usersService = new UsersService(prismaMock);
  });

  describe('findByEmail', () => {
    it('normalizes the email before searching', async () => {
      const result = await usersService.findByEmail(' Test@Example.COM ');

      expect(result).toEqual(user);
      expect(findUniqueMock).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
        },
      });
    });
  });

  describe('create', () => {
    it('normalizes user information before creating the record', async () => {
      const result = await usersService.create({
        email: ' Test@Example.COM ',
        passwordHash: 'hashed-password',
        firstName: ' Test ',
        lastName: ' User ',
      });

      expect(result).toEqual(user);
      expect(createMock).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          firstName: 'Test',
          lastName: 'User',
        },
      });
    });
  });
});
