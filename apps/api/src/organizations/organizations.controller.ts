import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AccessTokenPayload } from '../auth/interfaces/access-token-payload.interface';
import { CurrentMembership } from './decorators/current-membership.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationMemberGuard } from './guards/organization-member.guard';
import type { MembershipWithOrganization } from './interfaces/membership.interface';
import type {
  OrganizationDetailResponse,
  OrganizationListResponse,
} from './interfaces/organization-response.interface';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(AccessTokenGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() currentUser: AccessTokenPayload,
    @Body() createOrganizationDto: CreateOrganizationDto,
  ): Promise<OrganizationDetailResponse> {
    const organization = await this.organizationsService.create(
      currentUser.sub,
      createOrganizationDto.name,
    );

    return { organization };
  }

  @Get()
  async findAll(
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<OrganizationListResponse> {
    const organizations = await this.organizationsService.findAllForUser(
      currentUser.sub,
    );

    return { organizations };
  }

  @Get(':organizationId')
  @UseGuards(OrganizationMemberGuard)
  findOne(
    @CurrentMembership() membership: MembershipWithOrganization,
  ): OrganizationDetailResponse {
    return {
      organization: this.organizationsService.toMembershipResponse(membership),
    };
  }
}
