import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  MembershipWithOrganization,
  OrganizationRequest,
} from '../interfaces/membership.interface';

// Only valid on routes guarded by OrganizationMemberGuard.
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): MembershipWithOrganization => {
    const request = context.switchToHttp().getRequest<OrganizationRequest>();

    if (!request.membership) {
      throw new InternalServerErrorException(
        'CurrentMembership used without OrganizationMemberGuard',
      );
    }

    return request.membership;
  },
);
