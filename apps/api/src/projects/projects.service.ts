import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Project } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import type { ProjectResponse } from './interfaces/project-response.interface';

// Every query is scoped to the organization from the URL, so ids from
// another organization behave as if they do not exist.
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    archived: boolean,
  ): Promise<ProjectResponse[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        organizationId,
        archivedAt: archived ? { not: null } : null,
      },
      orderBy: { name: 'asc' },
    });

    return projects.map((project) => this.toResponse(project));
  }

  async create(
    organizationId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectResponse> {
    try {
      const project = await this.prisma.project.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          description: this.normalizeDescription(dto.description) ?? null,
        },
      });

      return this.toResponse(project);
    } catch (error: unknown) {
      throw this.mapWriteError(error);
    }
  }

  async get(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectResponse> {
    return this.toResponse(await this.findProject(organizationId, projectId));
  }

  async update(
    organizationId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('Provide a name or description to update');
    }

    await this.findProject(organizationId, projectId);

    try {
      const project = await this.prisma.project.update({
        where: { id: projectId },
        data: {
          name: dto.name?.trim(),
          description: this.normalizeDescription(dto.description),
        },
      });

      return this.toResponse(project);
    } catch (error: unknown) {
      throw this.mapWriteError(error);
    }
  }

  // Archiving or restoring twice is harmless and returns the project as is.
  async setArchived(
    organizationId: string,
    projectId: string,
    archived: boolean,
  ): Promise<ProjectResponse> {
    const project = await this.findProject(organizationId, projectId);

    if ((project.archivedAt !== null) === archived) {
      return this.toResponse(project);
    }

    try {
      const updated = await this.prisma.project.update({
        where: { id: projectId },
        data: { archivedAt: archived ? new Date() : null },
      });

      return this.toResponse(updated);
    } catch (error: unknown) {
      throw this.mapWriteError(error);
    }
  }

  async remove(organizationId: string, projectId: string): Promise<void> {
    try {
      const { count } = await this.prisma.project.deleteMany({
        where: { id: projectId, organizationId },
      });

      if (count === 0) {
        throw new NotFoundException('Project not found');
      }
    } catch (error: unknown) {
      throw this.mapWriteError(error);
    }
  }

  private async findProject(
    organizationId: string,
    projectId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  // Blank descriptions are stored as null; undefined means "leave as is".
  private normalizeDescription(
    description: string | null | undefined,
  ): string | null | undefined {
    if (description === undefined || description === null) {
      return description;
    }

    return description.trim() || null;
  }

  private toResponse(project: Project): ProjectResponse {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      archivedAt: project.archivedAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  // P2002: the name is taken. P2025: deleted meanwhile. P2003: something
  // still references the project (incidents, once they exist).
  private mapWriteError(error: unknown): unknown {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;

    switch (code) {
      case 'P2002':
        return new ConflictException('A project with this name already exists');
      case 'P2025':
        return new NotFoundException('Project not found');
      case 'P2003':
        return new ConflictException(
          'This project is still in use. Archive it instead.',
        );
      default:
        return error;
    }
  }
}
