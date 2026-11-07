import { Injectable } from '@nestjs/common';
import { IncidentPriority, IncidentStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { incidentSummaryInclude, toIncidentSummary } from './incident-mapper';
import { ACTIVE_STATUSES } from './incident-status';
import type { DashboardResponse } from './interfaces/incident-response.interface';

const RECENT_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string): Promise<DashboardResponse> {
    const [groups, critical, recentlyCreated, recentlyUpdated] =
      await Promise.all([
        this.prisma.incident.groupBy({
          by: ['status'],
          where: { organizationId },
          _count: { _all: true },
        }),
        this.prisma.incident.count({
          where: {
            organizationId,
            priority: IncidentPriority.CRITICAL,
            status: { in: [...ACTIVE_STATUSES] },
          },
        }),
        this.prisma.incident.findMany({
          where: { organizationId },
          include: incidentSummaryInclude,
          orderBy: { createdAt: 'desc' },
          take: RECENT_LIMIT,
        }),
        this.prisma.incident.findMany({
          where: { organizationId },
          include: incidentSummaryInclude,
          orderBy: { updatedAt: 'desc' },
          take: RECENT_LIMIT,
        }),
      ]);

    const byStatus = Object.fromEntries(
      Object.values(IncidentStatus).map((status) => [status, 0]),
    ) as Record<IncidentStatus, number>;

    for (const group of groups) {
      byStatus[group.status] = group._count._all;
    }

    return {
      counts: {
        byStatus,
        active: ACTIVE_STATUSES.reduce(
          (sum, status) => sum + byStatus[status],
          0,
        ),
        critical,
      },
      recentlyCreated: recentlyCreated.map(toIncidentSummary),
      recentlyUpdated: recentlyUpdated.map(toIncidentSummary),
    };
  }
}
