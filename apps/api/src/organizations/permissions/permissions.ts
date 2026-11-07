import { OrganizationRole } from '../../generated/prisma/client';

// Add a permission here and to the roles that should have it.
export type Permission =
  | 'members:view'
  | 'members:manage'
  | 'teams:view'
  | 'teams:manage'
  | 'projects:view'
  | 'projects:manage';

// Every member can see these.
const VIEW: readonly Permission[] = [
  'members:view',
  'teams:view',
  'projects:view',
];

// Owners and admins can change these.
const MANAGE: readonly Permission[] = [
  'members:manage',
  'teams:manage',
  'projects:manage',
];

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  [OrganizationRole.OWNER]: [...VIEW, ...MANAGE],
  [OrganizationRole.ADMIN]: [...VIEW, ...MANAGE],
  [OrganizationRole.MEMBER]: VIEW,
  [OrganizationRole.VIEWER]: VIEW,
};

export function hasPermission(
  role: OrganizationRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
