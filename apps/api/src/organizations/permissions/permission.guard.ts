import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationRequest } from '../interfaces/membership.interface';
import { hasPermission, type Permission } from './permissions';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permission) {
      return true;
    }

    const { membership } = context
      .switchToHttp()
      .getRequest<OrganizationRequest>();

    if (!membership) {
      throw new InternalServerErrorException(
        'PermissionGuard used without OrganizationMemberGuard',
      );
    }

    if (!hasPermission(membership.role, permission)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
