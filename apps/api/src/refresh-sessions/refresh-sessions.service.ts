import { Injectable } from '@nestjs/common';
import type { RefreshSession, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRefreshSessionData } from './create-refresh-session-data.interface';

export type RefreshSessionWithUser = RefreshSession & { user: User };

@Injectable()
export class RefreshSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshSessionData): Promise<RefreshSession> {
    return this.prisma.refreshSession.create({ data });
  }

  findById(id: string): Promise<RefreshSessionWithUser | null> {
    return this.prisma.refreshSession.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  // Only revokes an active session, so concurrent callers cannot both succeed.
  async revoke(id: string): Promise<boolean> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count === 1;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }

  // Returns null without creating a session if the old one was already revoked.
  rotate(
    oldSessionId: string,
    newSession: CreateRefreshSessionData,
  ): Promise<RefreshSession | null> {
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: { id: oldSessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        return null;
      }

      return tx.refreshSession.create({ data: newSession });
    });
  }
}
