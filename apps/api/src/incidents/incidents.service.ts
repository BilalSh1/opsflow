import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IncidentActivityType,
  IncidentPriority,
  IncidentStatus,
  type OrganizationMember,
  type Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateIncidentDto } from './dto/create-incident.dto';
import type { ListIncidentsQuery } from './dto/list-incidents.query';
import type { UpdateIncidentDto } from './dto/update-incident.dto';
import {
  fullName,
  incidentDetailInclude,
  incidentSummaryInclude,
  toIncidentDetail,
  toIncidentSummary,
} from './incident-mapper';
import { canTransition, lifecycleDates } from './incident-status';
import type {
  IncidentDetailResponse,
  IncidentListResponse,
} from './interfaces/incident-response.interface';

// The acting member, from the membership guard.
type Actor = Pick<OrganizationMember, 'id' | 'organizationId' | 'userId'>;
type Tx = Prisma.TransactionClient;

const DEFAULT_PAGE_SIZE = 20;
const ACTIVITY_VALUE_LENGTH = 255;

const truncate = (value: string | null) =>
  value !== null && value.length > ACTIVITY_VALUE_LENGTH
    ? `${value.slice(0, ACTIVITY_VALUE_LENGTH - 1)}…`
    : value;

// Blank descriptions are stored as null; undefined means "leave as is".
const normalizeDescription = (description: string | null | undefined) =>
  description === undefined || description === null
    ? description
    : description.trim() || null;

// Every query is scoped to the organization from the URL, so incidents of
// another organization behave as if they do not exist.
@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: Actor,
    query: ListIncidentsQuery,
  ): Promise<IncidentListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildWhere(actor, query);
    const orderBy: Prisma.IncidentOrderByWithRelationInput[] = [
      { [query.sort ?? 'updatedAt']: query.order ?? 'desc' },
      { number: 'desc' },
    ];

    const [total, incidents] = await this.prisma.$transaction([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        include: incidentSummaryInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      incidents: incidents.map(toIncidentSummary),
      page,
      pageSize,
      total,
    };
  }

  async get(
    organizationId: string,
    number: number,
  ): Promise<IncidentDetailResponse> {
    const incident = await this.prisma.incident.findFirst({
      where: { organizationId, number },
      include: incidentDetailInclude,
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return toIncidentDetail(incident);
  }

  create(
    actor: Actor,
    dto: CreateIncidentDto,
  ): Promise<IncidentDetailResponse> {
    const { organizationId } = actor;

    return this.prisma.$transaction(async (tx) => {
      const project = dto.projectId
        ? await this.findProject(tx, organizationId, dto.projectId)
        : null;
      const assignee = dto.assigneeId
        ? await this.findAssignee(tx, organizationId, dto.assigneeId)
        : null;
      const team = dto.assignedTeamId
        ? await this.findTeam(tx, organizationId, dto.assignedTeamId)
        : null;

      this.assertProjectAcceptsIncidents(project);

      // The row update serializes concurrent creates, so numbers never repeat.
      const { incidentCounter: number } = await tx.organization.update({
        where: { id: organizationId },
        data: { incidentCounter: { increment: 1 } },
        select: { incidentCounter: true },
      });

      const incident = await tx.incident.create({
        data: {
          organizationId,
          number,
          title: dto.title.trim(),
          description: normalizeDescription(dto.description) ?? null,
          priority: dto.priority ?? IncidentPriority.MEDIUM,
          projectId: project?.id ?? null,
          assigneeId: assignee?.id ?? null,
          assignedTeamId: team?.id ?? null,
          reporterId: actor.userId,
          activities: {
            create: {
              type: IncidentActivityType.CREATED,
              actorId: actor.userId,
            },
          },
        },
        include: incidentDetailInclude,
      });

      return toIncidentDetail(incident);
    });
  }

  // Applies the changed fields and records one activity entry per change.
  async update(
    actor: Actor,
    number: number,
    dto: UpdateIncidentDto,
  ): Promise<IncidentDetailResponse> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const { organizationId } = actor;

    return this.prisma.$transaction(async (tx) => {
      // Lock the row so concurrent status changes are applied one by one.
      await tx.$queryRaw`SELECT id FROM incidents WHERE organization_id = ${organizationId}::uuid AND number = ${number} FOR UPDATE`;

      const incident = await tx.incident.findFirst({
        where: { organizationId, number },
        include: incidentDetailInclude,
      });

      if (!incident) {
        throw new NotFoundException('Incident not found');
      }

      const changesMoreThanStatus = Object.entries(dto).some(
        ([field, value]) => field !== 'status' && value !== undefined,
      );

      if (incident.status === IncidentStatus.CLOSED && changesMoreThanStatus) {
        throw new ConflictException('Reopen this incident before changing it');
      }

      const data: Prisma.IncidentUncheckedUpdateInput = {};
      const activities: Prisma.IncidentActivityCreateManyInput[] = [];
      const record = (
        type: IncidentActivityType,
        oldValue: string | null = null,
        newValue: string | null = null,
      ) =>
        activities.push({
          incidentId: incident.id,
          actorId: actor.userId,
          type,
          oldValue: truncate(oldValue),
          newValue: truncate(newValue),
        });

      if (dto.title !== undefined) {
        const title = dto.title.trim();

        if (title !== incident.title) {
          data.title = title;
          record(IncidentActivityType.TITLE_CHANGED, incident.title, title);
        }
      }

      if (dto.description !== undefined) {
        const description = normalizeDescription(dto.description);

        if (description !== incident.description) {
          data.description = description;
          record(IncidentActivityType.DESCRIPTION_CHANGED);
        }
      }

      if (dto.priority !== undefined && dto.priority !== incident.priority) {
        data.priority = dto.priority;
        record(
          IncidentActivityType.PRIORITY_CHANGED,
          incident.priority,
          dto.priority,
        );
      }

      if (dto.status !== undefined && dto.status !== incident.status) {
        if (!canTransition(incident.status, dto.status)) {
          throw new BadRequestException(
            `Cannot change status from ${incident.status} to ${dto.status}`,
          );
        }

        Object.assign(data, {
          status: dto.status,
          ...lifecycleDates(dto.status, incident, new Date()),
        });
        record(
          IncidentActivityType.STATUS_CHANGED,
          incident.status,
          dto.status,
        );
      }

      if (dto.projectId !== undefined) {
        const project =
          dto.projectId === null
            ? null
            : await this.findProject(tx, organizationId, dto.projectId);

        if ((project?.id ?? null) !== incident.projectId) {
          this.assertProjectAcceptsIncidents(project);
          data.projectId = project?.id ?? null;
          record(
            IncidentActivityType.PROJECT_CHANGED,
            incident.project?.name ?? null,
            project?.name ?? null,
          );
        }
      }

      if (dto.assigneeId !== undefined) {
        const assignee =
          dto.assigneeId === null
            ? null
            : await this.findAssignee(tx, organizationId, dto.assigneeId);

        if ((assignee?.id ?? null) !== incident.assigneeId) {
          data.assigneeId = assignee?.id ?? null;
          record(
            IncidentActivityType.ASSIGNEE_CHANGED,
            incident.assignee ? fullName(incident.assignee.user) : null,
            assignee?.name ?? null,
          );
        }
      }

      if (dto.assignedTeamId !== undefined) {
        const team =
          dto.assignedTeamId === null
            ? null
            : await this.findTeam(tx, organizationId, dto.assignedTeamId);

        if ((team?.id ?? null) !== incident.assignedTeamId) {
          data.assignedTeamId = team?.id ?? null;
          record(
            IncidentActivityType.TEAM_CHANGED,
            incident.assignedTeam?.name ?? null,
            team?.name ?? null,
          );
        }
      }

      if (activities.length === 0) {
        return toIncidentDetail(incident);
      }

      const updated = await tx.incident.update({
        where: { id: incident.id },
        data,
        include: incidentDetailInclude,
      });

      await tx.incidentActivity.createMany({ data: activities });

      return toIncidentDetail(updated);
    });
  }

  private buildWhere(
    actor: Actor,
    query: ListIncidentsQuery,
  ): Prisma.IncidentWhereInput {
    const where: Prisma.IncidentWhereInput = {
      organizationId: actor.organizationId,
    };
    const idOrNone = (value: string) =>
      value.toLowerCase() === 'none' ? null : value;

    if (query.status?.length) {
      where.status = { in: query.status };
    }

    if (query.priority?.length) {
      where.priority = { in: query.priority };
    }

    if (query.projectId) {
      where.projectId = idOrNone(query.projectId);
    }

    if (query.assignedTeamId) {
      where.assignedTeamId = idOrNone(query.assignedTeamId);
    }

    if (query.assigneeId) {
      where.assigneeId =
        query.assigneeId.toLowerCase() === 'me'
          ? actor.id
          : idOrNone(query.assigneeId);
    }

    const search = query.search?.trim();

    if (search) {
      const numberMatch = /^(?:inc-)?(\d{1,9})$/i.exec(search);

      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        ...(numberMatch ? [{ number: Number(numberMatch[1]) }] : []),
      ];
    }

    return where;
  }

  private async findProject(tx: Tx, organizationId: string, projectId: string) {
    const project = await tx.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, name: true, archivedAt: true },
    });

    if (!project) {
      throw new BadRequestException('Project not found in this organization');
    }

    return project;
  }

  private assertProjectAcceptsIncidents(
    project: { archivedAt: Date | null } | null,
  ): void {
    if (project?.archivedAt) {
      throw new BadRequestException(
        'Archived projects cannot receive incidents',
      );
    }
  }

  private async findAssignee(tx: Tx, organizationId: string, memberId: string) {
    const member = await tx.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!member) {
      throw new BadRequestException(
        'The assignee must be a member of this organization',
      );
    }

    return { id: member.id, name: fullName(member.user) };
  }

  private async findTeam(tx: Tx, organizationId: string, teamId: string) {
    const team = await tx.team.findFirst({
      where: { id: teamId, organizationId },
      select: { id: true, name: true },
    });

    if (!team) {
      throw new BadRequestException('Team not found in this organization');
    }

    return team;
  }
}
