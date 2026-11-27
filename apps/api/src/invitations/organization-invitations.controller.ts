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
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentMembership } from '../organizations/decorators/current-membership.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import type { MembershipWithOrganization } from '../organizations/interfaces/membership.interface';
import { PermissionGuard } from '../organizations/permissions/permission.guard';
import { RequirePermission } from '../organizations/permissions/require-permission.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import type {
  CreatedInvitationResponse,
  InvitationListResponse,
} from './interfaces/invitation-response.interface';
import { InvitationsService } from './invitations.service';

// A malformed invitation id is just an unknown invitation.
const invitationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException('Invitation not found'),
});

@Controller('organizations/:organizationId/invitations')
@UseGuards(AccessTokenGuard, OrganizationMemberGuard, PermissionGuard)
export class OrganizationInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  @RequirePermission('members:manage')
  async list(
    @CurrentMembership() membership: MembershipWithOrganization,
  ): Promise<InvitationListResponse> {
    const invitations = await this.invitationsService.listPending(
      membership.organizationId,
    );

    return { invitations };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('members:manage')
  create(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Body() createInvitationDto: CreateInvitationDto,
  ): Promise<CreatedInvitationResponse> {
    return this.invitationsService.create(
      membership,
      createInvitationDto.email,
      createInvitationDto.role,
    );
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('members:manage')
  async revoke(
    @CurrentMembership() membership: MembershipWithOrganization,
    @Param('invitationId', invitationIdPipe) invitationId: string,
  ): Promise<void> {
    await this.invitationsService.revoke(
      membership.organizationId,
      invitationId,
    );
  }
}
