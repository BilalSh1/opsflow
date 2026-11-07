import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, type Team } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const teamId = 'c0ffee00-0000-4000-8000-000000000001';
  const memberId = 'b6f1d0c2-9e8a-4b7c-8d6e-5f4a3b2c1d0e';
  const createdAt = new Date('2026-11-07T10:00:00.000Z');

  const team: Team = {
    id: teamId,
    organizationId,
    name: 'Engineering',
    createdAt,
    updatedAt: createdAt,
  };

  const teamMemberRow = (firstName: string, id = memberId) => ({
    id: `tm-${id}`,
    teamId,
    organizationMemberId: id,
    createdAt,
    organizationMember: {
      id,
      userId: `user-${id}`,
      organizationId,
      role: OrganizationRole.MEMBER,
      createdAt,
      updatedAt: createdAt,
      user: {
        id: `user-${id}`,
        email: `${firstName.toLowerCase()}@example.test`,
        firstName,
        lastName: 'Test',
      },
    },
  });

  let prismaMock: {
    team: Record<
      'findMany' | 'findFirst' | 'create' | 'update' | 'deleteMany',
      jest.Mock
    >;
    teamMember: Record<'create' | 'deleteMany', jest.Mock>;
    organizationMember: Record<'findFirst', jest.Mock>;
  };
  let service: TeamsService;

  beforeEach(() => {
    prismaMock = {
      team: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(team),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      teamMember: {
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue({ id: memberId }),
      },
    };

    service = new TeamsService(prismaMock as unknown as PrismaService);
  });

  describe('list', () => {
    it("lists the organization's teams by name with member counts", async () => {
      prismaMock.team.findMany.mockResolvedValue([
        { ...team, _count: { members: 3 } },
      ]);

      await expect(service.list(organizationId)).resolves.toEqual([
        {
          id: teamId,
          name: 'Engineering',
          memberCount: 3,
          createdAt: createdAt.toISOString(),
        },
      ]);
      expect(prismaMock.team.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        include: { _count: { select: { members: true } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('creates a team with a trimmed name', async () => {
      prismaMock.team.create.mockResolvedValue(team);

      await expect(
        service.create(organizationId, '  Engineering  '),
      ).resolves.toMatchObject({ name: 'Engineering', memberCount: 0 });
      expect(prismaMock.team.create).toHaveBeenCalledWith({
        data: { organizationId, name: 'Engineering' },
      });
    });

    it('returns 409 when the name is taken in this organization', async () => {
      prismaMock.team.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create(organizationId, 'Engineering'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('get', () => {
    it('returns the team with its members sorted by name', async () => {
      prismaMock.team.findFirst.mockResolvedValue({
        ...team,
        members: [teamMemberRow('Zoe', 'm-2'), teamMemberRow('Adam', 'm-1')],
      });

      const result = await service.get(organizationId, teamId);

      expect(prismaMock.team.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: teamId, organizationId } }),
      );
      expect(result.members.map((member) => member.firstName)).toEqual([
        'Adam',
        'Zoe',
      ]);
      expect(result.members[0]).toEqual({
        memberId: 'm-1',
        userId: 'user-m-1',
        email: 'adam@example.test',
        firstName: 'Adam',
        lastName: 'Test',
        role: OrganizationRole.MEMBER,
        addedAt: createdAt.toISOString(),
      });
    });

    it('returns 404 for a team in another organization', async () => {
      prismaMock.team.findFirst.mockResolvedValue(null);

      await expect(service.get(organizationId, teamId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rename', () => {
    it('renames a team in this organization', async () => {
      prismaMock.team.update.mockResolvedValue({
        ...team,
        name: 'Platform',
        _count: { members: 2 },
      });

      await expect(
        service.rename(organizationId, teamId, ' Platform '),
      ).resolves.toMatchObject({ name: 'Platform', memberCount: 2 });
      expect(prismaMock.team.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: teamId },
          data: { name: 'Platform' },
        }),
      );
    });

    it('returns 404 without writing for a team in another organization', async () => {
      prismaMock.team.findFirst.mockResolvedValue(null);

      await expect(
        service.rename(organizationId, teamId, 'Platform'),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.team.update).not.toHaveBeenCalled();
    });

    it('returns 409 when the new name is taken', async () => {
      prismaMock.team.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.rename(organizationId, teamId, 'Support'),
      ).rejects.toThrow(ConflictException);
    });

    it('returns 404 when the team is deleted meanwhile', async () => {
      prismaMock.team.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        service.rename(organizationId, teamId, 'Support'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes only within the organization', async () => {
      await service.remove(organizationId, teamId);

      expect(prismaMock.team.deleteMany).toHaveBeenCalledWith({
        where: { id: teamId, organizationId },
      });
    });

    it('returns 404 when nothing was deleted', async () => {
      prismaMock.team.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove(organizationId, teamId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addMember', () => {
    it('adds a member of this organization to the team', async () => {
      prismaMock.teamMember.create.mockResolvedValue(teamMemberRow('Adam'));

      await expect(
        service.addMember(organizationId, teamId, memberId),
      ).resolves.toMatchObject({ memberId, firstName: 'Adam' });
      expect(prismaMock.organizationMember.findFirst).toHaveBeenCalledWith({
        where: { id: memberId, organizationId },
      });
      expect(prismaMock.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { teamId, organizationMemberId: memberId },
        }),
      );
    });

    it('returns 404 for a member of another organization', async () => {
      prismaMock.organizationMember.findFirst.mockResolvedValue(null);

      await expect(
        service.addMember(organizationId, teamId, memberId),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.teamMember.create).not.toHaveBeenCalled();
    });

    it('returns 404 for a team of another organization', async () => {
      prismaMock.team.findFirst.mockResolvedValue(null);

      await expect(
        service.addMember(organizationId, teamId, memberId),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.organizationMember.findFirst).not.toHaveBeenCalled();
    });

    it('returns 409 when the member is already in the team', async () => {
      prismaMock.teamMember.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.addMember(organizationId, teamId, memberId),
      ).rejects.toThrow('This member is already in the team');
    });
  });

  describe('removeMember', () => {
    it('removes the member from the team', async () => {
      await service.removeMember(organizationId, teamId, memberId);

      expect(prismaMock.teamMember.deleteMany).toHaveBeenCalledWith({
        where: { teamId, organizationMemberId: memberId },
      });
    });

    it('returns 404 when the member is not in the team', async () => {
      prismaMock.teamMember.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.removeMember(organizationId, teamId, memberId),
      ).rejects.toThrow('This member is not in the team');
    });

    it('returns 404 for a team of another organization', async () => {
      prismaMock.team.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMember(organizationId, teamId, memberId),
      ).rejects.toThrow('Team not found');
      expect(prismaMock.teamMember.deleteMany).not.toHaveBeenCalled();
    });
  });
});
