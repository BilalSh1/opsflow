import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import {
  InvitationStatus,
  OrganizationRole,
  type Invitation,
} from '../generated/prisma/client';
import type { OrganizationMembersService } from '../organizations/organization-members.service';
import type { OrganizationsService } from '../organizations/organizations.service';
import type { PrismaService } from '../prisma/prisma.service';
import { hashInvitationToken } from './invitation-token';
import { InvitationsService } from './invitations.service';

const { OWNER, ADMIN, MEMBER } = OrganizationRole;

describe('InvitationsService', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const invitationId = 'c0ffee00-0000-4000-8000-000000000001';
  const ownerUserId = '0aaaaaaa-0000-4000-8000-000000000001';
  const inviteeUserId = '0bbbbbbb-0000-4000-8000-000000000002';
  const token = 'A'.repeat(43);
  const createdAt = new Date('2026-11-20T10:00:00.000Z');

  const owner = { organizationId, userId: ownerUserId, role: OWNER };
  const admin = { organizationId, userId: ownerUserId, role: ADMIN };

  const invitation = (overrides: Partial<Invitation> = {}) => ({
    id: invitationId,
    organizationId,
    email: 'new@example.test',
    role: MEMBER,
    tokenHash: hashInvitationToken(token),
    status: InvitationStatus.PENDING,
    invitedById: ownerUserId,
    expiresAt: new Date(Date.now() + 60_000),
    respondedAt: null,
    createdAt,
    updatedAt: createdAt,
    invitedBy: { firstName: 'Olivia', lastName: 'Owner' },
    organization: { id: organizationId, name: 'Acme' },
    ...overrides,
  });

  // Echoes the written fields back, as Prisma returns the saved row.
  const withData = ({ data }: { data: Partial<Invitation> }) => ({
    ...invitation(),
    ...data,
  });

  let tx: {
    invitation: Record<
      'findFirst' | 'findUniqueOrThrow' | 'create' | 'update',
      jest.Mock
    >;
    organizationMember: Record<
      'findFirst' | 'create' | 'findUniqueOrThrow',
      jest.Mock
    >;
  };
  let prismaMock: {
    invitation: Record<'findMany' | 'findUnique' | 'updateMany', jest.Mock>;
    user: Record<'findUnique', jest.Mock>;
  };
  let organizationMembersService: {
    withOrganizationLock: jest.Mock;
    findByUser: jest.Mock;
  };
  let organizationsService: { toMembershipResponse: jest.Mock };
  let service: InvitationsService;

  beforeEach(() => {
    tx = {
      invitation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(invitation()),
        create: jest.fn(withData),
        update: jest.fn(withData),
      },
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ marker: 'member' }),
      },
    };
    prismaMock = {
      invitation: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(invitation()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: inviteeUserId, email: 'new@example.test' }),
      },
    };
    organizationMembersService = {
      withOrganizationLock: jest.fn((_id, work: (t: unknown) => unknown) =>
        work(tx),
      ),
      findByUser: jest.fn().mockResolvedValue(null),
    };
    organizationsService = {
      toMembershipResponse: jest.fn().mockReturnValue({ id: organizationId }),
    };

    service = new InvitationsService(
      prismaMock as unknown as PrismaService,
      organizationMembersService as unknown as OrganizationMembersService,
      organizationsService as unknown as OrganizationsService,
    );
  });

  describe('create', () => {
    it('creates a pending invitation and returns the token once', async () => {
      const result = await service.create(owner, ' New@Example.test ', MEMBER);

      const [{ data }] = tx.invitation.create.mock.calls[0] as [
        { data: Invitation },
      ];

      expect(data).toMatchObject({
        organizationId,
        email: 'new@example.test',
        role: MEMBER,
        invitedById: ownerUserId,
      });
      expect(data.tokenHash).toBe(hashInvitationToken(result.token));
      expect(data.tokenHash).not.toBe(result.token);
      expect(result.invitation).toMatchObject({
        email: 'new@example.test',
        role: MEMBER,
        expired: false,
        invitedBy: { firstName: 'Olivia', lastName: 'Owner' },
      });
    });

    it('replaces the token of an existing pending invitation', async () => {
      tx.invitation.findFirst.mockResolvedValue(invitation());

      const result = await service.create(owner, 'new@example.test', ADMIN);

      expect(tx.invitation.create).not.toHaveBeenCalled();
      expect(tx.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: invitationId },
          data: expect.objectContaining({
            role: ADMIN,
            tokenHash: hashInvitationToken(result.token),
          }) as unknown,
        }),
      );
    });

    it('rejects inviting someone who is already a member', async () => {
      tx.organizationMember.findFirst.mockResolvedValue({ id: 'member' });

      await expect(
        service.create(owner, 'new@example.test', MEMBER),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('only lets owners invite owners', async () => {
      await expect(
        service.create(admin, 'new@example.test', OWNER),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        organizationMembersService.withOrganizationLock,
      ).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('revokes a pending invitation of this organization only', async () => {
      await service.revoke(organizationId, invitationId);

      expect(prismaMock.invitation.updateMany).toHaveBeenCalledWith({
        where: {
          id: invitationId,
          organizationId,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.REVOKED,
          respondedAt: expect.any(Date) as unknown,
        },
      });
    });

    it('is a 404 when nothing matched', async () => {
      prismaMock.invitation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.revoke(organizationId, invitationId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('preview', () => {
    it('looks the invitation up by the hash of the token', async () => {
      const result = await service.preview(token);

      expect(prismaMock.invitation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashInvitationToken(token) },
        }),
      );
      expect(result.invitation).toMatchObject({
        email: 'new@example.test',
        state: InvitationStatus.PENDING,
        organization: { name: 'Acme' },
      });
    });

    it('reports an expired invitation', async () => {
      prismaMock.invitation.findUnique.mockResolvedValue(
        invitation({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.preview(token)).resolves.toMatchObject({
        invitation: { state: 'EXPIRED' },
      });
    });

    it('does not query the database for a malformed token', async () => {
      await expect(service.preview('not-a-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.invitation.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('accept', () => {
    it('adds the user with the invited role and marks it accepted', async () => {
      await expect(service.accept(token, inviteeUserId)).resolves.toEqual({
        id: organizationId,
      });

      expect(tx.organizationMember.create).toHaveBeenCalledWith({
        data: { organizationId, userId: inviteeUserId, role: MEMBER },
      });
      expect(tx.invitation.update).toHaveBeenCalledWith({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.ACCEPTED,
          respondedAt: expect.any(Date) as unknown,
        },
      });
    });

    it('requires the account to have the invited email', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: inviteeUserId,
        email: 'someone-else@example.test',
      });

      await expect(service.accept(token, inviteeUserId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(tx.organizationMember.create).not.toHaveBeenCalled();
    });

    it.each([
      ['revoked', { status: InvitationStatus.REVOKED }],
      ['accepted', { status: InvitationStatus.ACCEPTED }],
      ['expired', { expiresAt: new Date(Date.now() - 1000) }],
    ])('rejects an invitation that was %s', async (_label, overrides) => {
      tx.invitation.findUniqueOrThrow.mockResolvedValue(invitation(overrides));

      await expect(service.accept(token, inviteeUserId)).rejects.toBeInstanceOf(
        GoneException,
      );
      expect(tx.organizationMember.create).not.toHaveBeenCalled();
    });

    it('keeps the role of someone who is already a member', async () => {
      organizationMembersService.findByUser.mockResolvedValue({ role: ADMIN });

      await service.accept(token, inviteeUserId);

      expect(tx.organizationMember.create).not.toHaveBeenCalled();
      expect(tx.invitation.update).toHaveBeenCalled();
    });
  });

  describe('decline', () => {
    it('marks a pending invitation as declined', async () => {
      await service.decline(token);

      expect(prismaMock.invitation.updateMany).toHaveBeenCalledWith({
        where: { id: invitationId, status: InvitationStatus.PENDING },
        data: {
          status: InvitationStatus.DECLINED,
          respondedAt: expect.any(Date) as unknown,
        },
      });
    });

    it('rejects an invitation that is no longer pending', async () => {
      prismaMock.invitation.findUnique.mockResolvedValue(
        invitation({ status: InvitationStatus.REVOKED }),
      );

      await expect(service.decline(token)).rejects.toBeInstanceOf(
        GoneException,
      );
    });
  });
});
