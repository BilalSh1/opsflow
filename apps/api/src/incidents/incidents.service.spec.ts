import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  IncidentActivityType,
  IncidentPriority,
  IncidentStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from './incidents.service';

const { OPEN, INVESTIGATING, RESOLVED, CLOSED } = IncidentStatus;

describe('IncidentsService', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const actor = {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    organizationId,
    userId: 'bbbbbbbb-0000-4000-8000-000000000001',
  };
  const projectId = 'cccccccc-0000-4000-8000-000000000001';
  const memberId = 'dddddddd-0000-4000-8000-000000000001';
  const teamId = 'eeeeeeee-0000-4000-8000-000000000001';
  const at = new Date('2026-11-07T10:00:00.000Z');

  // A stored incident with everything loaded the way the service reads it.
  const incidentRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'ffffffff-0000-4000-8000-000000000001',
    organizationId,
    number: 7,
    title: 'Payment API returning 500 errors',
    description: 'Started at 13:00',
    status: OPEN,
    priority: IncidentPriority.HIGH,
    projectId: null,
    reporterId: actor.userId,
    assigneeId: null,
    assignedTeamId: null,
    createdAt: at,
    updatedAt: at,
    resolvedAt: null,
    closedAt: null,
    project: null,
    assignee: null,
    assignedTeam: null,
    reporter: { id: actor.userId, firstName: 'Ada', lastName: 'Lovelace' },
    ...overrides,
  });

  let prismaMock: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    incident: Record<
      'count' | 'findMany' | 'findFirst' | 'create' | 'update',
      jest.Mock
    >;
    incidentActivity: Record<'createMany', jest.Mock>;
    organization: Record<'update', jest.Mock>;
    project: Record<'findFirst', jest.Mock>;
    organizationMember: Record<'findFirst', jest.Mock>;
    team: Record<'findFirst', jest.Mock>;
  };
  let service: IncidentsService;

  beforeEach(() => {
    prismaMock = {
      // Callback transactions run against the same mock; array ones in parallel.
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prismaMock)
          : Promise.all(arg as unknown[]),
      ),
      $queryRaw: jest.fn().mockResolvedValue([]),
      incident: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(incidentRow()),
        create: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve(incidentRow({ ...args.data, activities: undefined })),
        ),
        update: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve(incidentRow(args.data)),
        ),
      },
      incidentActivity: { createMany: jest.fn().mockResolvedValue({}) },
      organization: {
        update: jest.fn().mockResolvedValue({ incidentCounter: 8 }),
      },
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: projectId,
          name: 'Payments',
          archivedAt: null,
        }),
      },
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue({
          id: memberId,
          user: { firstName: 'Bob', lastName: 'Builder' },
        }),
      },
      team: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: teamId, name: 'Engineering' }),
      },
    };

    service = new IncidentsService(prismaMock as unknown as PrismaService);
  });

  const createdData = () =>
    (
      prismaMock.incident.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ]
    )[0].data;
  const recordedActivities = () =>
    (
      prismaMock.incidentActivity.createMany.mock.calls[0] as [
        {
          data: {
            type: IncidentActivityType;
            oldValue: string | null;
            newValue: string | null;
          }[];
        },
      ]
    )[0].data;

  describe('create', () => {
    it('takes the next number for the organization inside the transaction', async () => {
      const result = await service.create(actor, {
        title: '  Payment API down ',
      });

      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: organizationId },
        data: { incidentCounter: { increment: 1 } },
        select: { incidentCounter: true },
      });
      expect(createdData()).toMatchObject({
        organizationId,
        number: 8,
        title: 'Payment API down',
        description: null,
        priority: IncidentPriority.MEDIUM,
        reporterId: actor.userId,
        activities: {
          create: { type: IncidentActivityType.CREATED, actorId: actor.userId },
        },
      });
      expect(result.number).toBe(8);
      expect(result.allowedStatuses).toEqual([
        INVESTIGATING,
        'BLOCKED',
        RESOLVED,
      ]);
    });

    it('links project, assignee and team after checking they belong to the organization', async () => {
      await service.create(actor, {
        title: 'Down',
        priority: IncidentPriority.CRITICAL,
        projectId,
        assigneeId: memberId,
        assignedTeamId: teamId,
      });

      expect(prismaMock.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: projectId, organizationId } }),
      );
      expect(prismaMock.organizationMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: memberId, organizationId } }),
      );
      expect(prismaMock.team.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: teamId, organizationId } }),
      );
      expect(createdData()).toMatchObject({
        priority: IncidentPriority.CRITICAL,
        projectId,
        assigneeId: memberId,
        assignedTeamId: teamId,
      });
    });

    it.each([
      ['project', 'project', { projectId }],
      ['assignee', 'organizationMember', { assigneeId: memberId }],
      ['team', 'team', { assignedTeamId: teamId }],
    ] as const)(
      'rejects a %s from another organization without taking a number',
      async (_label, model, fields) => {
        prismaMock[model].findFirst.mockResolvedValue(null);

        await expect(
          service.create(actor, { title: 'Down', ...fields }),
        ).rejects.toThrow(BadRequestException);
        expect(prismaMock.organization.update).not.toHaveBeenCalled();
      },
    );

    it('rejects archived projects', async () => {
      prismaMock.project.findFirst.mockResolvedValue({
        id: projectId,
        name: 'Legacy',
        archivedAt: at,
      });

      await expect(
        service.create(actor, { title: 'Down', projectId }),
      ).rejects.toThrow('Archived projects cannot receive incidents');
    });
  });

  describe('get', () => {
    it('returns 404 for an incident of another organization', async () => {
      prismaMock.incident.findFirst.mockResolvedValue(null);

      await expect(service.get(organizationId, 7)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.incident.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId, number: 7 } }),
      );
    });
  });

  describe('update', () => {
    it('locks the incident row before reading it', async () => {
      await service.update(actor, 7, { priority: IncidentPriority.CRITICAL });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
      const [sql] = prismaMock.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
      ];
      expect(sql.join('?')).toContain('FOR UPDATE');
    });

    it('records one activity per changed field with readable values', async () => {
      prismaMock.incident.findFirst.mockResolvedValue(
        incidentRow({
          projectId,
          project: { id: projectId, name: 'Payments' },
          assigneeId: 'old-member',
          assignee: {
            id: 'old-member',
            userId: 'old-user',
            user: { id: 'old-user', firstName: 'Old', lastName: 'Assignee' },
          },
        }),
      );

      await service.update(actor, 7, {
        title: 'Payments fully down',
        priority: IncidentPriority.CRITICAL,
        status: INVESTIGATING,
        projectId: null,
        assigneeId: memberId,
        assignedTeamId: teamId,
        description: 'More detail',
      });

      expect(recordedActivities()).toEqual([
        expect.objectContaining({
          type: IncidentActivityType.TITLE_CHANGED,
          oldValue: 'Payment API returning 500 errors',
          newValue: 'Payments fully down',
        }),
        expect.objectContaining({
          type: IncidentActivityType.DESCRIPTION_CHANGED,
          oldValue: null,
          newValue: null,
        }),
        expect.objectContaining({
          type: IncidentActivityType.PRIORITY_CHANGED,
          oldValue: 'HIGH',
          newValue: 'CRITICAL',
        }),
        expect.objectContaining({
          type: IncidentActivityType.STATUS_CHANGED,
          oldValue: 'OPEN',
          newValue: 'INVESTIGATING',
        }),
        expect.objectContaining({
          type: IncidentActivityType.PROJECT_CHANGED,
          oldValue: 'Payments',
          newValue: null,
        }),
        expect.objectContaining({
          type: IncidentActivityType.ASSIGNEE_CHANGED,
          oldValue: 'Old Assignee',
          newValue: 'Bob Builder',
        }),
        expect.objectContaining({
          type: IncidentActivityType.TEAM_CHANGED,
          oldValue: null,
          newValue: 'Engineering',
        }),
      ]);
    });

    it('sets resolvedAt when resolving', async () => {
      prismaMock.incident.findFirst.mockResolvedValue(
        incidentRow({ status: INVESTIGATING }),
      );

      await service.update(actor, 7, { status: RESOLVED });

      const [{ data }] = prismaMock.incident.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data).toMatchObject({ status: RESOLVED, closedAt: null });
      expect(data.resolvedAt).toBeInstanceOf(Date);
    });

    it('rejects status changes the workflow does not allow', async () => {
      await expect(
        service.update(actor, 7, { status: CLOSED }),
      ).rejects.toThrow('Cannot change status from OPEN to CLOSED');
      expect(prismaMock.incident.update).not.toHaveBeenCalled();
    });

    it('only allows reopening a closed incident', async () => {
      prismaMock.incident.findFirst.mockResolvedValue(
        incidentRow({ status: CLOSED, resolvedAt: at, closedAt: at }),
      );

      await expect(
        service.update(actor, 7, { title: 'Renamed' }),
      ).rejects.toThrow(ConflictException);

      await service.update(actor, 7, { status: OPEN });

      const [{ data }] = prismaMock.incident.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data).toMatchObject({
        status: OPEN,
        resolvedAt: null,
        closedAt: null,
      });
    });

    it('does not write when nothing actually changes', async () => {
      const result = await service.update(actor, 7, {
        title: ' Payment API returning 500 errors ',
        priority: IncidentPriority.HIGH,
        status: OPEN,
      });

      expect(prismaMock.incident.update).not.toHaveBeenCalled();
      expect(prismaMock.incidentActivity.createMany).not.toHaveBeenCalled();
      expect(result.title).toBe('Payment API returning 500 errors');
    });

    it('rejects an empty update', async () => {
      await expect(service.update(actor, 7, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('rejects moving an incident into an archived project', async () => {
      prismaMock.project.findFirst.mockResolvedValue({
        id: projectId,
        name: 'Legacy',
        archivedAt: at,
      });

      await expect(service.update(actor, 7, { projectId })).rejects.toThrow(
        'Archived projects cannot receive incidents',
      );
    });

    it('returns 404 for an incident of another organization', async () => {
      prismaMock.incident.findFirst.mockResolvedValue(null);

      await expect(
        service.update(actor, 7, { title: 'Renamed' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    const lastFindMany = () =>
      (
        prismaMock.incident.findMany.mock.calls.at(-1) as [
          {
            where: Record<string, unknown>;
            orderBy: unknown;
            skip: number;
            take: number;
          },
        ]
      )[0];

    it('defaults to the first page of 20, most recently updated first', async () => {
      prismaMock.incident.count.mockResolvedValue(42);

      const result = await service.list(actor, {});

      expect(lastFindMany()).toMatchObject({
        where: { organizationId },
        orderBy: [{ updatedAt: 'desc' }, { number: 'desc' }],
        skip: 0,
        take: 20,
      });
      expect(result).toMatchObject({ page: 1, pageSize: 20, total: 42 });
    });

    it('applies filters, sorting and paging', async () => {
      await service.list(actor, {
        page: 3,
        pageSize: 10,
        status: [OPEN, INVESTIGATING],
        priority: [IncidentPriority.CRITICAL],
        projectId: 'none',
        assignedTeamId: teamId,
        assigneeId: 'me',
        sort: 'priority',
        order: 'desc',
      });

      expect(lastFindMany()).toMatchObject({
        where: {
          organizationId,
          status: { in: [OPEN, INVESTIGATING] },
          priority: { in: [IncidentPriority.CRITICAL] },
          projectId: null,
          assignedTeamId: teamId,
          assigneeId: actor.id,
        },
        orderBy: [{ priority: 'desc' }, { number: 'desc' }],
        skip: 20,
        take: 10,
      });
    });

    it('searches titles and incident numbers', async () => {
      await service.list(actor, { search: 'INC-12' });

      expect(lastFindMany().where).toMatchObject({
        OR: [
          { title: { contains: 'INC-12', mode: 'insensitive' } },
          { number: 12 },
        ],
      });

      await service.list(actor, { search: 'payment' });

      expect(lastFindMany().where).toMatchObject({
        OR: [{ title: { contains: 'payment', mode: 'insensitive' } }],
      });
    });
  });
});
