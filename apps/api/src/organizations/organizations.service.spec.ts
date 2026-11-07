import { ConflictException } from '@nestjs/common';
import {
  OrganizationRole,
  type Organization,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MembershipWithOrganization } from './interfaces/membership.interface';
import type { OrganizationMembersService } from './organization-members.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  const userId = '76be9f15-77b2-4986-91cc-27154ab15b47';

  const organization: Organization = {
    id: '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    name: 'Acme Technologies',
    slug: 'acme-technologies',
    createdAt: new Date('2026-11-07T10:00:00.000Z'),
    updatedAt: new Date('2026-11-07T10:00:00.000Z'),
  };

  const createMock = jest.fn((): Promise<Organization> =>
    Promise.resolve(organization),
  );

  const prismaMock = {
    organization: { create: createMock },
  } as unknown as PrismaService;

  let organizationMembersServiceMock: jest.Mocked<
    Pick<OrganizationMembersService, 'findAllForUser'>
  >;

  let organizationsService: OrganizationsService;

  beforeEach(() => {
    jest.clearAllMocks();

    organizationMembersServiceMock = {
      findAllForUser: jest.fn(),
    };

    organizationsService = new OrganizationsService(
      prismaMock,
      organizationMembersServiceMock as unknown as OrganizationMembersService,
    );
  });

  describe('create', () => {
    it('creates the organization with the creator as owner', async () => {
      const result = await organizationsService.create(
        userId,
        '  Acme Technologies ',
      );

      expect(createMock).toHaveBeenCalledWith({
        data: {
          name: 'Acme Technologies',
          slug: 'acme-technologies',
          members: {
            create: { userId, role: OrganizationRole.OWNER },
          },
        },
      });

      expect(result).toEqual({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: OrganizationRole.OWNER,
        createdAt: organization.createdAt.toISOString(),
      });
    });

    it('retries with a suffixed slug when the slug is taken', async () => {
      createMock.mockRejectedValueOnce({ code: 'P2002' });

      await organizationsService.create(userId, 'Acme Technologies');

      expect(createMock).toHaveBeenCalledTimes(2);

      const calls = createMock.mock.calls as unknown as [
        { data: { slug: string } },
      ][];

      expect(calls[0][0].data.slug).toBe('acme-technologies');
      expect(calls[1][0].data.slug).toMatch(/^acme-technologies-[0-9a-f]{6}$/);
    });

    it('gives up after repeated slug conflicts', async () => {
      createMock.mockRejectedValue({ code: 'P2002' });

      await expect(
        organizationsService.create(userId, 'Acme Technologies'),
      ).rejects.toThrow(ConflictException);

      expect(createMock).toHaveBeenCalledTimes(5);

      createMock.mockReset();
      createMock.mockResolvedValue(organization);
    });

    it('rethrows other database errors without retrying', async () => {
      const failure = new Error('connection lost');
      createMock.mockRejectedValueOnce(failure);

      await expect(
        organizationsService.create(userId, 'Acme Technologies'),
      ).rejects.toBe(failure);

      expect(createMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAllForUser', () => {
    it("returns the user's organizations with their role", async () => {
      const membership: MembershipWithOrganization = {
        id: 'b6f1d0c2-9e8a-4b7c-8d6e-5f4a3b2c1d0e',
        userId,
        organizationId: organization.id,
        role: OrganizationRole.VIEWER,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
        organization,
      };

      organizationMembersServiceMock.findAllForUser.mockResolvedValue([
        membership,
      ]);

      const result = await organizationsService.findAllForUser(userId);

      expect(
        organizationMembersServiceMock.findAllForUser,
      ).toHaveBeenCalledWith(userId);

      expect(result).toEqual([
        {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          role: OrganizationRole.VIEWER,
          createdAt: organization.createdAt.toISOString(),
        },
      ]);
    });
  });
});
