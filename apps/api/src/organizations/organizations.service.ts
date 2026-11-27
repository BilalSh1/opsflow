import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationRole,
  type Organization,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MembershipWithOrganization } from './interfaces/membership.interface';
import type { OrganizationResponse } from './interfaces/organization-response.interface';
import { OrganizationMembersService } from './organization-members.service';
import { slugify, withRandomSuffix } from './slug';

const MAX_SLUG_ATTEMPTS = 5;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMembersService: OrganizationMembersService,
  ) {}

  // The creator becomes OWNER. The nested create runs in one transaction,
  // so an organization never exists without its owner.
  async create(userId: string, name: string): Promise<OrganizationResponse> {
    const trimmedName = name.trim();
    const baseSlug = slugify(trimmedName);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 0 ? baseSlug : withRandomSuffix(baseSlug);

      try {
        const organization = await this.prisma.organization.create({
          data: {
            name: trimmedName,
            slug,
            members: {
              create: { userId, role: OrganizationRole.OWNER },
            },
          },
        });

        return this.toResponse(organization, OrganizationRole.OWNER);
      } catch (error: unknown) {
        if (!this.isSlugConflict(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException(
      'Could not generate a unique organization slug',
    );
  }

  async findAllForUser(userId: string): Promise<OrganizationResponse[]> {
    const memberships =
      await this.organizationMembersService.findAllForUser(userId);

    return memberships.map((membership) =>
      this.toMembershipResponse(membership),
    );
  }

  // The slug is kept, so existing links and ids stay valid after a rename.
  async rename(
    membership: MembershipWithOrganization,
    name: string,
  ): Promise<OrganizationResponse> {
    try {
      const organization = await this.prisma.organization.update({
        where: { id: membership.organizationId },
        data: { name: name.trim() },
      });

      return this.toResponse(organization, membership.role);
    } catch (error: unknown) {
      throw this.notFoundIfMissing(error);
    }
  }

  // Removes everything the organization owns (members, teams, projects,
  // incidents, invitations) through the database cascades.
  async delete(organizationId: string): Promise<void> {
    try {
      await this.prisma.organization.delete({ where: { id: organizationId } });
    } catch (error: unknown) {
      throw this.notFoundIfMissing(error);
    }
  }

  toMembershipResponse(
    membership: MembershipWithOrganization,
  ): OrganizationResponse {
    return this.toResponse(membership.organization, membership.role);
  }

  private toResponse(
    organization: Organization,
    role: OrganizationRole,
  ): OrganizationResponse {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role,
      createdAt: organization.createdAt.toISOString(),
    };
  }

  // Deleted by someone else between the guard and this query.
  private notFoundIfMissing(error: unknown): unknown {
    const missing =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2025';

    return missing ? new NotFoundException('Organization not found') : error;
  }

  private isSlugConflict(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    return 'code' in error && error.code === 'P2002';
  }
}
