import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentMembership } from '../organizations/decorators/current-membership.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import type { MembershipWithOrganization } from '../organizations/interfaces/membership.interface';
import { PermissionGuard } from '../organizations/permissions/permission.guard';
import { RequirePermission } from '../organizations/permissions/require-permission.decorator';
import { DashboardService } from './dashboard.service';
import type { DashboardResponse } from './interfaces/incident-response.interface';

@Controller('organizations/:organizationId/dashboard')
@UseGuards(AccessTokenGuard, OrganizationMemberGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequirePermission('incidents:view')
  get(
    @CurrentMembership() membership: MembershipWithOrganization,
  ): Promise<DashboardResponse> {
    return this.dashboardService.get(membership.organizationId);
  }
}
