import { OrganizationRole } from '../generated/prisma/client';
import type { MembershipWithOrganization } from './interfaces/membership.interface';
import type { OrganizationResponse } from './interfaces/organization-response.interface';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsController', () => {
  const currentUser = {
    sub: '76be9f15-77b2-4986-91cc-27154ab15b47',
    email: 'test@example.com',
  };

  const organizationResponse: OrganizationResponse = {
    id: '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    name: 'Acme Technologies',
    slug: 'acme-technologies',
    role: OrganizationRole.OWNER,
    createdAt: '2026-11-07T10:00:00.000Z',
  };

  let organizationsServiceMock: jest.Mocked<
    Pick<
      OrganizationsService,
      'create' | 'findAllForUser' | 'toMembershipResponse'
    >
  >;
  let controller: OrganizationsController;

  beforeEach(() => {
    organizationsServiceMock = {
      create: jest.fn(),
      findAllForUser: jest.fn(),
      toMembershipResponse: jest.fn(),
    };

    controller = new OrganizationsController(
      organizationsServiceMock as unknown as OrganizationsService,
    );
  });

  it('creates an organization for the current user', async () => {
    organizationsServiceMock.create.mockResolvedValue(organizationResponse);

    const result = await controller.create(currentUser, {
      name: 'Acme Technologies',
    });

    expect(organizationsServiceMock.create).toHaveBeenCalledWith(
      currentUser.sub,
      'Acme Technologies',
    );
    expect(result).toEqual({ organization: organizationResponse });
  });

  it("lists the current user's organizations", async () => {
    organizationsServiceMock.findAllForUser.mockResolvedValue([
      organizationResponse,
    ]);

    const result = await controller.findAll(currentUser);

    expect(organizationsServiceMock.findAllForUser).toHaveBeenCalledWith(
      currentUser.sub,
    );
    expect(result).toEqual({ organizations: [organizationResponse] });
  });

  it('returns the organization from the guarded membership', () => {
    const membership = {
      role: OrganizationRole.OWNER,
    } as MembershipWithOrganization;

    organizationsServiceMock.toMembershipResponse.mockReturnValue(
      organizationResponse,
    );

    expect(controller.findOne(membership)).toEqual({
      organization: organizationResponse,
    });
    expect(organizationsServiceMock.toMembershipResponse).toHaveBeenCalledWith(
      membership,
    );
  });
});
