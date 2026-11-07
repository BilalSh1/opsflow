import { OrganizationRole } from '../generated/prisma/client';
import type { MembershipWithOrganization } from './interfaces/membership.interface';
import type { MemberResponse } from './interfaces/member-response.interface';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

describe('MembersController', () => {
  const membership = {
    organizationId: '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    userId: '76be9f15-77b2-4986-91cc-27154ab15b47',
    role: OrganizationRole.ADMIN,
  } as MembershipWithOrganization;

  const memberId = 'b6f1d0c2-9e8a-4b7c-8d6e-5f4a3b2c1d0e';

  const memberResponse: MemberResponse = {
    id: memberId,
    userId: 'a1a1a1a1-1111-4111-8111-111111111111',
    email: 'new@example.test',
    firstName: 'New',
    lastName: 'Person',
    role: OrganizationRole.MEMBER,
    joinedAt: '2026-11-07T10:00:00.000Z',
  };

  let membersServiceMock: jest.Mocked<
    Pick<MembersService, 'list' | 'add' | 'updateRole' | 'remove'>
  >;
  let controller: MembersController;

  beforeEach(() => {
    membersServiceMock = {
      list: jest.fn(),
      add: jest.fn(),
      updateRole: jest.fn(),
      remove: jest.fn(),
    };

    controller = new MembersController(
      membersServiceMock as unknown as MembersService,
    );
  });

  it('lists the members of the guarded organization', async () => {
    membersServiceMock.list.mockResolvedValue([memberResponse]);

    await expect(controller.list(membership)).resolves.toEqual({
      members: [memberResponse],
    });
    expect(membersServiceMock.list).toHaveBeenCalledWith(
      membership.organizationId,
    );
  });

  it('adds a member as the current user', async () => {
    membersServiceMock.add.mockResolvedValue(memberResponse);

    await expect(
      controller.add(membership, {
        email: 'new@example.test',
        role: OrganizationRole.MEMBER,
      }),
    ).resolves.toEqual({ member: memberResponse });
    expect(membersServiceMock.add).toHaveBeenCalledWith(
      membership,
      'new@example.test',
      OrganizationRole.MEMBER,
    );
  });

  it('updates a role', async () => {
    membersServiceMock.updateRole.mockResolvedValue(memberResponse);

    await expect(
      controller.updateRole(membership, memberId, {
        role: OrganizationRole.MEMBER,
      }),
    ).resolves.toEqual({ member: memberResponse });
    expect(membersServiceMock.updateRole).toHaveBeenCalledWith(
      membership,
      memberId,
      OrganizationRole.MEMBER,
    );
  });

  it('removes a member', async () => {
    membersServiceMock.remove.mockResolvedValue(undefined);

    await controller.remove(membership, memberId);

    expect(membersServiceMock.remove).toHaveBeenCalledWith(
      membership,
      memberId,
    );
  });
});
