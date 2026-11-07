import { Injectable } from '@nestjs/common';
import {
  OrganizationRole,
  type OrganizationMember,
  type Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  MemberWithUser,
  MembershipWithOrganization,
} from './interfaces/membership.interface';

type Db = PrismaService | Prisma.TransactionClient;

const memberUserFields = {
  select: { id: true, email: true, firstName: true, lastName: true },
} as const;

@Injectable()
export class OrganizationMembersService {
  constructor(private readonly prisma: PrismaService) {}

  findMembership(
    organizationId: string,
    userId: string,
  ): Promise<MembershipWithOrganization | null> {
    return this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      include: { organization: true },
    });
  }

  findAllForUser(userId: string): Promise<MembershipWithOrganization[]> {
    return this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { organization: { createdAt: 'desc' } },
    });
  }

  // Owners first, then admins, members and viewers (enum order), then name.
  findAllInOrganization(organizationId: string): Promise<MemberWithUser[]> {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: memberUserFields },
      orderBy: [
        { role: 'asc' },
        { user: { firstName: 'asc' } },
        { user: { lastName: 'asc' } },
      ],
    });
  }

  create(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
  ): Promise<MemberWithUser> {
    return this.prisma.organizationMember.create({
      data: { organizationId, userId, role },
      include: { user: memberUserFields },
    });
  }

  // Runs `work` while holding a row lock on the organization, so checks
  // such as "is this the last owner?" cannot race with each other.
  withOrganizationLock<T>(
    organizationId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;

      return work(tx);
    });
  }

  findByUser(
    db: Db,
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null> {
    return db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
  }

  findInOrganization(
    db: Db,
    organizationId: string,
    memberId: string,
  ): Promise<OrganizationMember | null> {
    return db.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
  }

  countOwners(db: Db, organizationId: string): Promise<number> {
    return db.organizationMember.count({
      where: { organizationId, role: OrganizationRole.OWNER },
    });
  }

  updateRole(
    db: Db,
    memberId: string,
    role: OrganizationRole,
  ): Promise<MemberWithUser> {
    return db.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: memberUserFields },
    });
  }

  async delete(db: Db, memberId: string): Promise<void> {
    await db.organizationMember.delete({ where: { id: memberId } });
  }
}
