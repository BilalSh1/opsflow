import { OrganizationRole } from '../../generated/prisma/client';

// Add a permission here and to the roles that should have it.
export type Permission =
  | 'organization:manage'
  | 'organization:delete'
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
  'organization:manage',
  'members:manage',
  'teams:manage',
  'projects:manage',
];

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  // Deleting the organization is for owners only.
  [OrganizationRole.OWNER]: [
    ...VIEW,
    ...CONTRIBUTE,
    ...MANAGE,
    'organization:delete',
  ],
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

// Only owners may give out the OWNER role, directly or by invitation.
export function mayGrantRole(
  actorRole: OrganizationRole,
  role: OrganizationRole,
): boolean {
  return (
    role !== OrganizationRole.OWNER || actorRole === OrganizationRole.OWNER
  );
}
