import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

// Checked by PermissionGuard, which must run after OrganizationMemberGuard.
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
