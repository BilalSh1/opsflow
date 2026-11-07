import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { OrganizationRole } from '../../generated/prisma/client';
import type {
  MembershipWithOrganization,
  OrganizationRequest,
} from '../interfaces/membership.interface';
import type { OrganizationMembersService } from '../organization-members.service';
import { OrganizationMemberGuard } from './organization-member.guard';

describe('OrganizationMemberGuard', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const userId = '76be9f15-77b2-4986-91cc-27154ab15b47';

  const membership: MembershipWithOrganization = {
    id: 'b6f1d0c2-9e8a-4b7c-8d6e-5f4a3b2c1d0e',
    userId,
    organizationId,
    role: OrganizationRole.MEMBER,
    createdAt: new Date('2026-11-07T10:00:00.000Z'),
    updatedAt: new Date('2026-11-07T10:00:00.000Z'),
    organization: {
      id: organizationId,
      name: 'Acme Technologies',
      slug: 'acme-technologies',
      createdAt: new Date('2026-11-07T10:00:00.000Z'),
      updatedAt: new Date('2026-11-07T10:00:00.000Z'),
    },
  };

  let findMembershipMock: jest.MockedFunction<
    OrganizationMembersService['findMembership']
  >;
  let guard: OrganizationMemberGuard;

  const contextFor = (request: Partial<OrganizationRequest>) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const requestFor = (
    params: Record<string, string>,
    user: OrganizationRequest['user'] = { sub: userId, email: 'a@b.test' },
  ) => ({ params, user }) as unknown as OrganizationRequest;

  beforeEach(() => {
    findMembershipMock = jest.fn();

    guard = new OrganizationMemberGuard({
      findMembership: findMembershipMock,
    } as unknown as OrganizationMembersService);
  });

  it('allows a member and attaches the membership to the request', async () => {
    findMembershipMock.mockResolvedValue(membership);
    const request = requestFor({ organizationId });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(findMembershipMock).toHaveBeenCalledWith(organizationId, userId);
    expect(request.membership).toBe(membership);
  });

  it('returns 404 for users who are not members', async () => {
    findMembershipMock.mockResolvedValue(null);
    const request = requestFor({ organizationId });

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      NotFoundException,
    );

    expect(request.membership).toBeUndefined();
  });

  it.each(['not-a-uuid', '123', ''])(
    'rejects the malformed organization id %p',
    async (id) => {
      await expect(
        guard.canActivate(contextFor(requestFor({ organizationId: id }))),
      ).rejects.toThrow(BadRequestException);

      expect(findMembershipMock).not.toHaveBeenCalled();
    },
  );

  it('rejects unauthenticated requests', async () => {
    const request = {
      params: { organizationId },
    } as unknown as OrganizationRequest;

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
