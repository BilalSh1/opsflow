import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Project } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const projectId = 'abcdef00-0000-4000-8000-000000000001';
  const createdAt = new Date('2026-11-07T10:00:00.000Z');

  const project: Project = {
    id: projectId,
    organizationId,
    name: 'Payments',
    description: 'Card processing',
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  let prismaMock: {
    project: Record<
      'findMany' | 'findFirst' | 'create' | 'update' | 'deleteMany',
      jest.Mock
    >;
  };
  let service: ProjectsService;

  beforeEach(() => {
    prismaMock = {
      project: {
        findMany: jest.fn().mockResolvedValue([project]),
        findFirst: jest.fn().mockResolvedValue(project),
        create: jest.fn().mockResolvedValue(project),
        update: jest.fn((args: { data: Partial<Project> }) =>
          Promise.resolve({ ...project, ...args.data }),
        ),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    service = new ProjectsService(prismaMock as unknown as PrismaService);
  });

  describe('list', () => {
    it('lists active projects by name', async () => {
      const [result] = await service.list(organizationId, false);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { organizationId, archivedAt: null },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual({
        id: projectId,
        name: 'Payments',
        description: 'Card processing',
        archivedAt: null,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      });
    });

    it('lists archived projects when asked', async () => {
      await service.list(organizationId, true);

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { organizationId, archivedAt: { not: null } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('trims the name and stores a blank description as null', async () => {
      await service.create(organizationId, {
        name: '  Payments ',
        description: '   ',
      });

      expect(prismaMock.project.create).toHaveBeenCalledWith({
        data: { organizationId, name: 'Payments', description: null },
      });
    });

    it('returns 409 when the name is taken', async () => {
      prismaMock.project.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create(organizationId, { name: 'Payments' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('get', () => {
    it('looks the project up within the organization', async () => {
      await service.get(organizationId, projectId);

      expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
        where: { id: projectId, organizationId },
      });
    });

    it('returns 404 for a project of another organization', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      await expect(service.get(organizationId, projectId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates only the fields that were sent', async () => {
      await service.update(organizationId, projectId, { name: ' Billing ' });

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { name: 'Billing', description: undefined },
      });
    });

    it('clears the description with null', async () => {
      const result = await service.update(organizationId, projectId, {
        description: null,
      });

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { name: undefined, description: null },
      });
      expect(result.description).toBeNull();
    });

    it('rejects an empty update', async () => {
      await expect(
        service.update(organizationId, projectId, {}),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('returns 404 without writing for a project of another organization', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      await expect(
        service.update(organizationId, projectId, { name: 'Billing' }),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('returns 409 when the new name is taken', async () => {
      prismaMock.project.update.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.update(organizationId, projectId, { name: 'Support' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setArchived', () => {
    it('archives an active project', async () => {
      const result = await service.setArchived(organizationId, projectId, true);

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { archivedAt: expect.any(Date) as Date },
      });
      expect(result.archivedAt).not.toBeNull();
    });

    it('does nothing when the project is already archived', async () => {
      prismaMock.project.findFirst.mockResolvedValue({
        ...project,
        archivedAt: createdAt,
      });

      const result = await service.setArchived(organizationId, projectId, true);

      expect(prismaMock.project.update).not.toHaveBeenCalled();
      expect(result.archivedAt).toBe(createdAt.toISOString());
    });

    it('restores an archived project', async () => {
      prismaMock.project.findFirst.mockResolvedValue({
        ...project,
        archivedAt: createdAt,
      });

      const result = await service.setArchived(
        organizationId,
        projectId,
        false,
      );

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { archivedAt: null },
      });
      expect(result.archivedAt).toBeNull();
    });

    it('does nothing when restoring an active project', async () => {
      await service.setArchived(organizationId, projectId, false);

      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes only within the organization', async () => {
      await service.remove(organizationId, projectId);

      expect(prismaMock.project.deleteMany).toHaveBeenCalledWith({
        where: { id: projectId, organizationId },
      });
    });

    it('returns 404 when nothing was deleted', async () => {
      prismaMock.project.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove(organizationId, projectId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('asks to archive instead when something still references it', async () => {
      prismaMock.project.deleteMany.mockRejectedValue({ code: 'P2003' });

      await expect(service.remove(organizationId, projectId)).rejects.toThrow(
        'This project is still in use. Archive it instead.',
      );
    });
  });
});
