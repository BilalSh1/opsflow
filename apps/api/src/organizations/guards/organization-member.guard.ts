import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { OrganizationRequest } from '../interfaces/membership.interface';
import { OrganizationMembersService } from '../organization-members.service';

// Tenant boundary for every /organizations/:organizationId route. Must run
// after AccessTokenGuard. Non-members get 404, so guessing ids does not
// reveal which organizations exist.
@Injectable()
export class OrganizationMemberGuard implements CanActivate {
  constructor(
    private readonly organizationMembersService: OrganizationMembersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OrganizationRequest>();

    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const organizationId = request.params.organizationId;

    if (typeof organizationId !== 'string' || !isUUID(organizationId)) {
      throw new BadRequestException('Invalid organization id');
    }

    const membership = await this.organizationMembersService.findMembership(
      organizationId,
      request.user.sub,
    );

    if (!membership) {
      throw new NotFoundException('Organization not found');
    }

    request.membership = membership;

    return true;
  }
}
