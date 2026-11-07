import { PrismaService } from '../prisma/prisma.service';
import { OrganizationMembersService } from './organization-members.service';

describe('OrganizationMembersService', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const userId = '76be9f15-77b2-4986-91cc-27154ab15b47';

  const findUniqueMock = jest.fn(() => Promise.resolve(null));
  const findManyMock = jest.fn(() => Promise.resolve([]));

  const prismaMock = {
    organizationMember: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
    },
  } as unknown as PrismaService;

  let organizationMembersService: OrganizationMembersService;

  beforeEach(() => {
    jest.clearAllMocks();
    organizationMembersService = new OrganizationMembersService(prismaMock);
  });

  it('looks up one membership by organization and user', async () => {
    await organizationMembersService.findMembership(organizationId, userId);

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId, userId } },
      include: { organization: true },
    });
  });

  it("lists the user's memberships, newest organization first", async () => {
    await organizationMembersService.findAllForUser(userId);

    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId },
      include: { organization: true },
      orderBy: { organization: { createdAt: 'desc' } },
    });
  });
});
