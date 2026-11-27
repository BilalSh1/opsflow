import type {
  AcceptedInvitation,
  CreatedInvitation,
  Invitation,
  InvitationPreview,
} from '../types/invitation'
import type { Organization, OrganizationRole } from '../types/organization'
import { apiRequest } from './client'

const organizationInvitationsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/invitations`

const invitationPath = (token: string) =>
  `/invitations/${encodeURIComponent(token)}`

export async function listInvitations(
  organizationId: string,
): Promise<Invitation[]> {
  const { invitations } = await apiRequest<{ invitations: Invitation[] }>(
    organizationInvitationsPath(organizationId),
  )

  return invitations
}

export function createInvitation(
  organizationId: string,
  email: string,
  role: OrganizationRole,
): Promise<CreatedInvitation> {
  return apiRequest<CreatedInvitation>(
    organizationInvitationsPath(organizationId),
    { method: 'POST', body: { email, role } },
  )
}

export function revokeInvitation(
  organizationId: string,
  invitationId: string,
): Promise<void> {
  return apiRequest<void>(
    `${organizationInvitationsPath(organizationId)}/${encodeURIComponent(invitationId)}`,
    { method: 'DELETE' },
  )
}

export async function getInvitation(token: string): Promise<InvitationPreview> {
  const { invitation } = await apiRequest<{ invitation: InvitationPreview }>(
    invitationPath(token),
  )

  return invitation
}

export async function acceptInvitation(
  token: string,
): Promise<AcceptedInvitation> {
  const { organization } = await apiRequest<{ organization: Organization }>(
    `${invitationPath(token)}/accept`,
    { method: 'POST' },
  )

  return organization
}

export function declineInvitation(token: string): Promise<void> {
  return apiRequest<void>(`${invitationPath(token)}/decline`, {
    method: 'POST',
  })
}

// The link the invited person opens; the token is its only secret.
export function invitationLink(token: string): string {
  return `${window.location.origin}/invitations/${encodeURIComponent(token)}`
}
