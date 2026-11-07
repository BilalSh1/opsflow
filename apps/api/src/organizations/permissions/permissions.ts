import { OrganizationRole } from '../../generated/prisma/client';

// Add a permission here and to the roles that should have it.
export type Permission =
  'members:view' | 'members:manage' | 'teams:view' | 'teams:manage';

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  [OrganizationRole.OWNER]: [
    'members:view',
    'members:manage',
    'teams:view',
    'teams:manage',
  ],
  [OrganizationRole.ADMIN]: [
    'members:view',
    'members:manage',
    'teams:view',
    'teams:manage',
  ],
  [OrganizationRole.MEMBER]: ['members:view', 'teams:view'],
  [OrganizationRole.VIEWER]: ['members:view', 'teams:view'],
};

export function hasPermission(
  role: OrganizationRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
