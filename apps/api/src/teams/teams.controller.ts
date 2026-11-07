import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentMembership } from '../organizations/decorators/current-membership.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import type { MembershipWithOrganization } from '../organizations/interfaces/membership.interface';
import { PermissionGuard } from '../organizations/permissions/permission.guard';
import { RequirePermission } from '../organizations/permissions/require-permission.decorator';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { TeamNameDto } from './dto/team-name.dto';
import type {
  TeamDetailResponse,
  TeamMemberResponse,
  TeamSummaryResponse,
} from './interfaces/team-response.interface';
import { TeamsService } from './teams.service';

// Malformed ids are treated as unknown ones.
const teamIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException('Team not found'),
});
const memberIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException('Member not found'),
});

@Controller('organizations/:organizationId/teams')
@UseGuards(AccessTokenGuard, OrganizationMemberGuard, PermissionGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @RequirePermission('teams:view')
  async list(
    @CurrentMembership() membership: MembershipWithOrganization,
  ): Promise<{ teams: TeamSummaryResponse[] }> {
    const teams = await this.teamsService.list(membership.organizationId);

    return { teams };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('teams:manage')
  async create(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Body() teamNameDto: TeamNameDto,
  ): Promise<{ team: TeamSummaryResponse }> {
    const team = await this.teamsService.create(
      membership.organizationId,
      teamNameDto.name,
    );

    return { team };
  }

  @Get(':teamId')
  @RequirePermission('teams:view')
  async get(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('teamId', teamIdPipe) teamId: string,
  ): Promise<{ team: TeamDetailResponse }> {
    const team = await this.teamsService.get(membership.organizationId, teamId);

    return { team };
  }

  @Patch(':teamId')
  @RequirePermission('teams:manage')
  async rename(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('teamId', teamIdPipe) teamId: string,
    @Body() teamNameDto: TeamNameDto,
  ): Promise<{ team: TeamSummaryResponse }> {
    const team = await this.teamsService.rename(
      membership.organizationId,
      teamId,
      teamNameDto.name,
    );

    return { team };
  }

  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('teams:manage')
  async remove(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('teamId', teamIdPipe) teamId: string,
  ): Promise<void> {
    await this.teamsService.remove(membership.organizationId, teamId);
  }

  @Post(':teamId/members')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('teams:manage')
  async addMember(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('teamId', teamIdPipe) teamId: string,
    @Body() addTeamMemberDto: AddTeamMemberDto,
  ): Promise<{ member: TeamMemberResponse }> {
    const member = await this.teamsService.addMember(
      membership.organizationId,
      teamId,
      addTeamMemberDto.memberId,
    );

    return { member };
  }

  @Delete(':teamId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('teams:manage')
  async removeMember(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('teamId', teamIdPipe) teamId: string,
    @Param('memberId', memberIdPipe) memberId: string,
  ): Promise<void> {
    await this.teamsService.removeMember(
      membership.organizationId,
      teamId,
      memberId,
    );
  }
}
