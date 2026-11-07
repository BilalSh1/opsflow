import type { MembershipWithOrganization } from '../organizations/interfaces/membership.interface';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

describe('TeamsController', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const teamId = 'c0ffee00-0000-4000-8000-000000000001';
  const memberId = 'b6f1d0c2-9e8a-4b7c-8d6e-5f4a3b2c1d0e';
  const membership = { organizationId } as MembershipWithOrganization;

  const summary = {
    id: teamId,
    name: 'Engineering',
    memberCount: 0,
    createdAt: '2026-11-07T10:00:00.000Z',
  };

  let teamsServiceMock: jest.Mocked<
    Pick<
      TeamsService,
      | 'list'
      | 'create'
      | 'get'
      | 'rename'
      | 'remove'
      | 'addMember'
      | 'removeMember'
    >
  >;
  let controller: TeamsController;

  beforeEach(() => {
    teamsServiceMock = {
      list: jest.fn().mockResolvedValue([summary]),
      create: jest.fn().mockResolvedValue(summary),
      get: jest.fn().mockResolvedValue({ ...summary, members: [] }),
      rename: jest.fn().mockResolvedValue(summary),
      remove: jest.fn().mockResolvedValue(undefined),
      addMember: jest.fn().mockResolvedValue({ memberId }),
      removeMember: jest.fn().mockResolvedValue(undefined),
    };

    controller = new TeamsController(
      teamsServiceMock as unknown as TeamsService,
    );
  });

  it('scopes every call to the guarded organization', async () => {
    await expect(controller.list(membership)).resolves.toEqual({
      teams: [summary],
    });
    await expect(
      controller.create(membership, { name: 'Engineering' }),
    ).resolves.toEqual({ team: summary });
    await controller.get(membership, teamId);
    await controller.rename(membership, teamId, { name: 'Platform' });
    await controller.remove(membership, teamId);
    await expect(
      controller.addMember(membership, teamId, { memberId }),
    ).resolves.toEqual({ member: { memberId } });
    await controller.removeMember(membership, teamId, memberId);

    expect(teamsServiceMock.list).toHaveBeenCalledWith(organizationId);
    expect(teamsServiceMock.create).toHaveBeenCalledWith(
      organizationId,
      'Engineering',
    );
    expect(teamsServiceMock.get).toHaveBeenCalledWith(organizationId, teamId);
    expect(teamsServiceMock.rename).toHaveBeenCalledWith(
      organizationId,
      teamId,
      'Platform',
    );
    expect(teamsServiceMock.remove).toHaveBeenCalledWith(
      organizationId,
      teamId,
    );
    expect(teamsServiceMock.addMember).toHaveBeenCalledWith(
      organizationId,
      teamId,
      memberId,
    );
    expect(teamsServiceMock.removeMember).toHaveBeenCalledWith(
      organizationId,
      teamId,
      memberId,
    );
  });
});
