import type { RefreshSession } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRefreshSessionData } from './create-refresh-session-data.interface';
import { RefreshSessionsService } from './refresh-sessions.service';

describe('RefreshSessionsService', () => {
  const sessionData: CreateRefreshSessionData = {
    id: '0c6f4f1e-6a0b-4b39-9d7e-2f8f1c2b9a10',
    userId: '76be9f15-77b2-4986-91cc-27154ab15b47',
    tokenHash: 'token-hash',
    expiresAt: new Date('2026-08-12T10:00:00.000Z'),
  };

  const session: RefreshSession = {
    ...sessionData,
    revokedAt: null,
    createdAt: new Date('2026-08-05T10:00:00.000Z'),
    updatedAt: new Date('2026-08-05T10:00:00.000Z'),
  };

  const createMock = jest.fn((): Promise<RefreshSession> =>
    Promise.resolve(session),
  );

  const findUniqueMock = jest.fn((): Promise<RefreshSession | null> =>
    Promise.resolve(session),
  );

  const updateManyMock = jest.fn((): Promise<{ count: number }> =>
    Promise.resolve({ count: 1 }),
  );

  const refreshSessionDelegate = {
    create: createMock,
    findUnique: findUniqueMock,
    updateMany: updateManyMock,
  };

  const transactionMock = jest.fn(
    (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ refreshSession: refreshSessionDelegate }),
  );

  const prismaMock = {
    refreshSession: refreshSessionDelegate,
    $transaction: transactionMock,
  } as unknown as PrismaService;

  let refreshSessionsService: RefreshSessionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    refreshSessionsService = new RefreshSessionsService(prismaMock);
  });

  describe('create', () => {
    it('stores the session data as given', async () => {
      await refreshSessionsService.create(sessionData);

      expect(createMock).toHaveBeenCalledWith({ data: sessionData });
    });
  });

  describe('findById', () => {
    it('looks up the session by id and includes its user', async () => {
      await refreshSessionsService.findById(sessionData.id);

      expect(findUniqueMock).toHaveBeenCalledWith({
        where: { id: sessionData.id },
        include: { user: true },
      });
    });
  });

  describe('revoke', () => {
    it('revokes only an active session', async () => {
      await expect(refreshSessionsService.revoke(sessionData.id)).resolves.toBe(
        true,
      );

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { id: sessionData.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('returns false when the session was already revoked', async () => {
      updateManyMock.mockResolvedValueOnce({ count: 0 });

      await expect(refreshSessionsService.revoke(sessionData.id)).resolves.toBe(
        false,
      );
    });
  });

  describe('revokeAllForUser', () => {
    it('revokes every active session of the user', async () => {
      updateManyMock.mockResolvedValueOnce({ count: 3 });

      await expect(
        refreshSessionsService.revokeAllForUser(sessionData.userId),
      ).resolves.toBe(3);

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { userId: sessionData.userId, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });
  });

  describe('rotate', () => {
    const newSessionData: CreateRefreshSessionData = {
      ...sessionData,
      id: '5d1f7a52-3c2e-4e7a-8b1d-9a6c4e2f0b31',
      tokenHash: 'new-token-hash',
    };

    it('revokes the old session and creates the new one in a transaction', async () => {
      const result = await refreshSessionsService.rotate(
        sessionData.id,
        newSessionData,
      );

      expect(transactionMock).toHaveBeenCalledTimes(1);

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { id: sessionData.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) as Date },
      });

      expect(createMock).toHaveBeenCalledWith({ data: newSessionData });

      expect(result).toBe(session);
    });

    it('returns null and creates nothing when the old session was already revoked', async () => {
      updateManyMock.mockResolvedValueOnce({ count: 0 });

      const result = await refreshSessionsService.rotate(
        sessionData.id,
        newSessionData,
      );

      expect(result).toBeNull();
      expect(createMock).not.toHaveBeenCalled();
    });
  });
});
