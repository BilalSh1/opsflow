import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationRole,
  type OrganizationMember,
  type User,
} from '../generated/prisma/client';
import type { UsersService } from '../users/users.service';
import type { MemberWithUser } from './interfaces/membership.interface';
import { MembersService } from './members.service';
import type { OrganizationMembersService } from './organization-members.service';

const { OWNER, ADMIN, MEMBER, VIEWER } = OrganizationRole;

describe('MembersService', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const tx = { marker: 'transaction' };

  const user: User = {
    id: 'a1a1a1a1-1111-4111-8111-111111111111',
    email: 'new@example.test',
    passwordHash: 'hash',
    firstName: 'New',
    lastName: 'Person',
    createdAt: new Date('2026-11-07T10:00:00.000Z'),
    updatedAt: new Date('2026-11-07T10:00:00.000Z'),
  };

  const membershipOf = (
    userId: string,
    role: OrganizationRole,
    id = `${userId.slice(0, 8)}-0000-4000-8000-000000000000`,
  ): OrganizationMember => ({
    id,
    userId,
    organizationId,
    role,
    createdAt: new Date('2026-11-07T10:00:00.000Z'),
    updatedAt: new Date('2026-11-07T10:00:00.000Z'),
  });

  const withUser = (member: OrganizationMember): MemberWithUser => ({
    ...member,
    user: {
      id: member.userId,
      email: `${member.userId.slice(0, 4)}@example.test`,
      firstName: 'First',
      lastName: 'Last',
    },
  });

  const owner = membershipOf('0aaaaaaa-0000-4000-8000-000000000001', OWNER);
  const admin = membershipOf('0bbbbbbb-0000-4000-8000-000000000002', ADMIN);
  const member = membershipOf('0ccccccc-0000-4000-8000-000000000003', MEMBER);
  const viewer = membershipOf('0eeeeeee-0000-4000-8000-000000000005', VIEWER);
  const secondOwner = membershipOf(
    '0ddddddd-0000-4000-8000-000000000004',
    OWNER,
  );

  // What findByUser returns inside the lock: the actor's current membership.
  let currentMemberships: OrganizationMember[];

  let membersMock: jest.Mocked<
    Pick<
      OrganizationMembersService,
      | 'findAllInOrganization'
      | 'create'
      | 'withOrganizationLock'
      | 'findByUser'
      | 'findInOrganization'
      | 'countOwners'
      | 'updateRole'
      | 'delete'
    >
  >;
  let usersMock: jest.Mocked<Pick<UsersService, 'findByEmail'>>;
  let service: MembersService;

  // Makes findInOrganization return `target` and countOwners return `owners`.
  const givenTarget = (target: OrganizationMember | null, owners = 1) => {
    membersMock.findInOrganization.mockResolvedValue(target);
    membersMock.countOwners.mockResolvedValue(owners);
  };

  beforeEach(() => {
    currentMemberships = [owner, admin, member, viewer, secondOwner];

    membersMock = {
      findAllInOrganization: jest.fn(),
      create: jest.fn(),
      withOrganizationLock: jest.fn(
        (_id: string, work: (client: never) => Promise<unknown>) =>
          work(tx as never),
      ) as never,
      findByUser: jest.fn((_db, _organizationId, userId: string) =>
        Promise.resolve(
          currentMemberships.find((current) => current.userId === userId) ??
            null,
        ),
      ),
      findInOrganization: jest.fn(),
      countOwners: jest.fn(),
      updateRole: jest.fn((_db, id, role) =>
        Promise.resolve(withUser({ ...member, id, role })),
      ),
      delete: jest.fn(() => Promise.resolve()),
    };

    usersMock = { findByEmail: jest.fn() };

    service = new MembersService(
      membersMock as unknown as OrganizationMembersService,
      usersMock as unknown as UsersService,
    );
  });

  describe('list', () => {
    it('maps members without exposing anything but profile fields', async () => {
      membersMock.findAllInOrganization.mockResolvedValue([withUser(owner)]);

      const [result] = await service.list(organizationId);

      expect(result).toEqual({
        id: owner.id,
        userId: owner.userId,
        email: '0aaa@example.test',
        firstName: 'First',
        lastName: 'Last',
        role: OWNER,
        joinedAt: owner.createdAt.toISOString(),
      });
    });
  });

  describe('add', () => {
    it('adds an existing user with the given role', async () => {
      usersMock.findByEmail.mockResolvedValue(user);
      membersMock.create.mockResolvedValue(
        withUser(membershipOf(user.id, MEMBER)),
      );

      const result = await service.add(admin, user.email, MEMBER);

      expect(usersMock.findByEmail).toHaveBeenCalledWith(user.email);
      expect(membersMock.create).toHaveBeenCalledWith(
        organizationId,
        user.id,
        MEMBER,
      );
      expect(result.role).toBe(MEMBER);
    });

    it('returns 404 when no account has the email', async () => {
      usersMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.add(admin, 'missing@example.test', MEMBER),
      ).rejects.toThrow(NotFoundException);
      expect(membersMock.create).not.toHaveBeenCalled();
    });

    it('returns 409 when the user is already a member', async () => {
      usersMock.findByEmail.mockResolvedValue(user);
      membersMock.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.add(admin, user.email, MEMBER)).rejects.toThrow(
        ConflictException,
      );
    });

    it('lets owners add owners', async () => {
      usersMock.findByEmail.mockResolvedValue(user);
      membersMock.create.mockResolvedValue(
        withUser(membershipOf(user.id, OWNER)),
      );

      await expect(
        service.add(owner, user.email, OWNER),
      ).resolves.toMatchObject({ role: OWNER });
    });

    it('does not let admins add owners', async () => {
      await expect(service.add(admin, user.email, OWNER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(usersMock.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('changes a role inside the organization lock', async () => {
      givenTarget(member);

      const result = await service.updateRole(admin, member.id, VIEWER);

      expect(membersMock.withOrganizationLock).toHaveBeenCalledWith(
        organizationId,
        expect.any(Function),
      );
      expect(membersMock.findInOrganization).toHaveBeenCalledWith(
        tx,
        organizationId,
        member.id,
      );
      expect(membersMock.updateRole).toHaveBeenCalledWith(
        tx,
        member.id,
        VIEWER,
      );
      expect(result.role).toBe(VIEWER);
    });

    it('returns 404 for a member of another organization', async () => {
      givenTarget(null);

      await expect(
        service.updateRole(admin, member.id, VIEWER),
      ).rejects.toThrow(NotFoundException);
      expect(membersMock.updateRole).not.toHaveBeenCalled();
    });

    it('does not let admins promote anyone to owner', async () => {
      await expect(service.updateRole(admin, member.id, OWNER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(membersMock.withOrganizationLock).not.toHaveBeenCalled();
    });

    it('does not let admins change an owner', async () => {
      givenTarget(owner, 2);

      await expect(service.updateRole(admin, owner.id, MEMBER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(membersMock.updateRole).not.toHaveBeenCalled();
    });

    it('lets an owner demote another owner when one remains', async () => {
      givenTarget(secondOwner, 2);

      await service.updateRole(owner, secondOwner.id, ADMIN);

      expect(membersMock.updateRole).toHaveBeenCalledWith(
        tx,
        secondOwner.id,
        ADMIN,
      );
    });

    it('blocks demoting the last owner, including yourself', async () => {
      givenTarget(owner, 1);

      await expect(service.updateRole(owner, owner.id, ADMIN)).rejects.toThrow(
        ConflictException,
      );
      expect(membersMock.updateRole).not.toHaveBeenCalled();
    });

    it('does not count owners when the role stays owner', async () => {
      givenTarget(owner, 1);

      await service.updateRole(owner, owner.id, OWNER);

      expect(membersMock.countOwners).not.toHaveBeenCalled();
    });

    it("uses the actor's current role, read inside the lock", async () => {
      // The guard saw an admin, but they were demoted before the lock.
      currentMemberships = [{ ...admin, role: MEMBER }, member];
      givenTarget(member);

      await expect(
        service.updateRole(admin, member.id, VIEWER),
      ).rejects.toThrow(ForbiddenException);
      expect(membersMock.findByUser).toHaveBeenCalledWith(
        tx,
        organizationId,
        admin.userId,
      );
      expect(membersMock.updateRole).not.toHaveBeenCalled();
    });

    it('returns 404 when the actor was removed before the lock', async () => {
      currentMemberships = [member];
      givenTarget(member);

      await expect(
        service.updateRole(admin, member.id, VIEWER),
      ).rejects.toThrow(NotFoundException);
      expect(membersMock.updateRole).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lets admins remove a member', async () => {
      givenTarget(member);

      await service.remove(admin, member.id);

      expect(membersMock.delete).toHaveBeenCalledWith(tx, member.id);
    });

    it('lets any member remove themselves', async () => {
      givenTarget(viewer);

      await service.remove(viewer, viewer.id);

      expect(membersMock.delete).toHaveBeenCalledWith(tx, viewer.id);
    });

    it('does not let members remove others', async () => {
      givenTarget(admin);

      await expect(service.remove(member, admin.id)).rejects.toThrow(
        ForbiddenException,
      );
      expect(membersMock.delete).not.toHaveBeenCalled();
    });

    it('does not let admins remove an owner', async () => {
      givenTarget(owner, 2);

      await expect(service.remove(admin, owner.id)).rejects.toThrow(
        ForbiddenException,
      );
      expect(membersMock.delete).not.toHaveBeenCalled();
    });

    it('blocks the last owner from leaving', async () => {
      givenTarget(owner, 1);

      await expect(service.remove(owner, owner.id)).rejects.toThrow(
        ConflictException,
      );
      expect(membersMock.delete).not.toHaveBeenCalled();
    });

    it('lets an owner leave when another owner remains', async () => {
      givenTarget(owner, 2);

      await service.remove(owner, owner.id);

      expect(membersMock.delete).toHaveBeenCalledWith(tx, owner.id);
    });

    it('returns 404 for a member of another organization', async () => {
      givenTarget(null);

      await expect(service.remove(admin, member.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not let a just-demoted admin remove others', async () => {
      currentMemberships = [{ ...admin, role: VIEWER }, member];
      givenTarget(member);

      await expect(service.remove(admin, member.id)).rejects.toThrow(
        ForbiddenException,
      );
      expect(membersMock.delete).not.toHaveBeenCalled();
    });
  });
});
