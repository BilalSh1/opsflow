import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { MembershipWithOrganization } from './interfaces/membership.interface';

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
}
