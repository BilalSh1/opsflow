import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentMembership } from '../organizations/decorators/current-membership.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import type { MembershipWithOrganization } from '../organizations/interfaces/membership.interface';
import { PermissionGuard } from '../organizations/permissions/permission.guard';
import { RequirePermission } from '../organizations/permissions/require-permission.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import type { ProjectResponse } from './interfaces/project-response.interface';
import { ProjectsService } from './projects.service';

// A malformed project id is just an unknown project.
const projectIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException('Project not found'),
});

type ProjectBody = { project: ProjectResponse };

@Controller('organizations/:organizationId/projects')
@UseGuards(AccessTokenGuard, OrganizationMemberGuard, PermissionGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // Active projects by default; ?archived=true lists archived ones.
  @Get()
  @RequirePermission('projects:view')
  async list(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Query('archived', new ParseBoolPipe({ optional: true }))
    archived: boolean | undefined,
  ): Promise<{ projects: ProjectResponse[] }> {
    const projects = await this.projectsService.list(
      membership.organizationId,
      archived ?? false,
    );

    return { projects };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('projects:manage')
  async create(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Body() createProjectDto: CreateProjectDto,
  ): Promise<ProjectBody> {
    const project = await this.projectsService.create(
      membership.organizationId,
      createProjectDto,
    );

    return { project };
  }

  @Get(':projectId')
  @RequirePermission('projects:view')
  async get(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('projectId', projectIdPipe) projectId: string,
  ): Promise<ProjectBody> {
    const project = await this.projectsService.get(
      membership.organizationId,
      projectId,
    );

    return { project };
  }

  @Patch(':projectId')
  @RequirePermission('projects:manage')
  async update(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('projectId', projectIdPipe) projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectBody> {
    const project = await this.projectsService.update(
      membership.organizationId,
      projectId,
      updateProjectDto,
    );

    return { project };
  }

  @Post(':projectId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:manage')
  async archive(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('projectId', projectIdPipe) projectId: string,
  ): Promise<ProjectBody> {
    const project = await this.projectsService.setArchived(
      membership.organizationId,
      projectId,
      true,
    );

    return { project };
  }

  @Post(':projectId/unarchive')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:manage')
  async unarchive(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('projectId', projectIdPipe) projectId: string,
  ): Promise<ProjectBody> {
    const project = await this.projectsService.setArchived(
      membership.organizationId,
      projectId,
      false,
    );

    return { project };
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('projects:manage')
  async remove(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('projectId', projectIdPipe) projectId: string,
  ): Promise<void> {
    await this.projectsService.remove(membership.organizationId, projectId);
  }
}
