import { IncidentPriority, IncidentStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

  it('counts incidents by status and lists recent ones', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(2);
    const groupBy = jest.fn().mockResolvedValue([
      { status: IncidentStatus.OPEN, _count: { _all: 3 } },
      { status: IncidentStatus.BLOCKED, _count: { _all: 1 } },
      { status: IncidentStatus.CLOSED, _count: { _all: 5 } },
    ]);
    const service = new DashboardService({
      incident: { findMany, count, groupBy },
    } as unknown as PrismaService);

    const result = await service.get(organizationId);

    expect(result.counts).toEqual({
      byStatus: {
        OPEN: 3,
        INVESTIGATING: 0,
        BLOCKED: 1,
        RESOLVED: 0,
        CLOSED: 5,
      },
      active: 4,
      critical: 2,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        organizationId,
        priority: IncidentPriority.CRITICAL,
        status: {
          in: [
            IncidentStatus.OPEN,
            IncidentStatus.INVESTIGATING,
            IncidentStatus.BLOCKED,
          ],
        },
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 5 }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { updatedAt: 'desc' }, take: 5 }),
    );
  });
});
