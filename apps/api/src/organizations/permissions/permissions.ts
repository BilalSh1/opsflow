import { OrganizationRole } from '../../generated/prisma/client';

// Add a permission here and to the roles that should have it.
export type Permission =
  | 'members:view'
  | 'members:manage'
  | 'teams:view'
  | 'teams:manage'
  | 'projects:view'
  | 'projects:manage'
  | 'incidents:view'
  | 'incidents:create'
  | 'incidents:update'
  | 'incidents:comment';

// Every member can see these.
const VIEW: readonly Permission[] = [
  'members:view',
  'teams:view',
  'projects:view',
  'incidents:view',
];

// Everyone except viewers can work on incidents.
const CONTRIBUTE: readonly Permission[] = [
  'incidents:create',
  'incidents:update',
  'incidents:comment',
];

// Owners and admins can change these.
const MANAGE: readonly Permission[] = [
  'members:manage',
  'teams:manage',
  'projects:manage',
];

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  [OrganizationRole.OWNER]: [...VIEW, ...CONTRIBUTE, ...MANAGE],
  [OrganizationRole.ADMIN]: [...VIEW, ...CONTRIBUTE, ...MANAGE],
  [OrganizationRole.MEMBER]: [...VIEW, ...CONTRIBUTE],
  [OrganizationRole.VIEWER]: VIEW,
};

export function hasPermission(
  role: OrganizationRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
