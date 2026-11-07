import type { OrganizationRole } from '../../types/organization'

// Mirrors the API's rules to decide which controls to show. The API is
// still the authority and rejects anything not allowed.

export const ROLES: OrganizationRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']

export const roleLabels: Record<OrganizationRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}

export function canManageMembers(role: OrganizationRole): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function canManageTeams(role: OrganizationRole): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

// Roles the actor may hand out; only owners may grant OWNER.
export function grantableRoles(actorRole: OrganizationRole): OrganizationRole[] {
  return actorRole === 'OWNER' ? ROLES : ROLES.filter((role) => role !== 'OWNER')
}

// Whether the actor may change or remove a member holding `targetRole`.
export function canManageMember(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole,
): boolean {
  if (!canManageMembers(actorRole)) {
    return false
  }

  return targetRole !== 'OWNER' || actorRole === 'OWNER'
}
