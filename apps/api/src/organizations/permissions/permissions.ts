import { OrganizationRole } from '../../generated/prisma/client';

// Add a permission here and to the roles that should have it.
export type Permission = 'members:view' | 'members:manage';

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  [OrganizationRole.OWNER]: ['members:view', 'members:manage'],
  [OrganizationRole.ADMIN]: ['members:view', 'members:manage'],
  [OrganizationRole.MEMBER]: ['members:view'],
  [OrganizationRole.VIEWER]: ['members:view'],
};

export function hasPermission(
  role: OrganizationRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
