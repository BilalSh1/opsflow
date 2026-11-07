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
import { CurrentMembership } from './decorators/current-membership.decorator';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { OrganizationMemberGuard } from './guards/organization-member.guard';
import type { MembershipWithOrganization } from './interfaces/membership.interface';
import type {
  MemberDetailResponse,
  MemberListResponse,
} from './interfaces/member-response.interface';
import { MembersService } from './members.service';
import { PermissionGuard } from './permissions/permission.guard';
import { RequirePermission } from './permissions/require-permission.decorator';

// A malformed member id is just an unknown member.
const memberIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException('Member not found'),
});

@Controller('organizations/:organizationId/members')
@UseGuards(AccessTokenGuard, OrganizationMemberGuard, PermissionGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @RequirePermission('members:view')
  async list(
    @CurrentMembership() membership: MembershipWithOrganization,
  ): Promise<MemberListResponse> {
    const members = await this.membersService.list(membership.organizationId);

    return { members };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('members:manage')
  async add(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Body() addMemberDto: AddMemberDto,
  ): Promise<MemberDetailResponse> {
    const member = await this.membersService.add(
      membership,
      addMemberDto.email,
      addMemberDto.role,
    );

    return { member };
  }

  @Patch(':memberId')
  @RequirePermission('members:manage')
  async updateRole(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('memberId', memberIdPipe) memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
  ): Promise<MemberDetailResponse> {
    const member = await this.membersService.updateRole(
      membership,
      memberId,
      updateMemberRoleDto.role,
    );

    return { member };
  }

  // No permission requirement: members may remove themselves. The service
  // checks members:manage when removing someone else.
  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('memberId', memberIdPipe) memberId: string,
  ): Promise<void> {
    await this.membersService.remove(membership, memberId);
  }
}
