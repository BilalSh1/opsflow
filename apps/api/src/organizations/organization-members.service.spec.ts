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

  it('finds a membership by user with the given client', async () => {
    const db = { organizationMember: { findUnique: jest.fn() } };

    await organizationMembersService.findByUser(
      db as unknown as PrismaService,
      organizationId,
      userId,
    );

    expect(db.organizationMember.findUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId, userId } },
    });
  });

  it('lists organization members by role, then name', async () => {
    await organizationMembersService.findAllInOrganization(organizationId);

    expect(findManyMock).toHaveBeenCalledWith({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [
        { role: 'asc' },
        { user: { firstName: 'asc' } },
        { user: { lastName: 'asc' } },
      ],
    });
  });

  it('locks the organization row before running the work', async () => {
    const queryRawMock = jest.fn(() => Promise.resolve([]));
    const tx = { $queryRaw: queryRawMock };
    const transactionMock = jest.fn(
      (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    );
    const service = new OrganizationMembersService({
      $transaction: transactionMock,
    } as unknown as PrismaService);

    const result = await service.withOrganizationLock(
      organizationId,
      (client) => {
        expect(client).toBe(tx);
        return Promise.resolve('done');
      },
    );

    expect(result).toBe('done');
    expect(queryRawMock).toHaveBeenCalledTimes(1);

    const [sql, ...values] = queryRawMock.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];

    expect(sql.join('?')).toContain('FOR UPDATE');
    expect(values).toEqual([organizationId]);
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
