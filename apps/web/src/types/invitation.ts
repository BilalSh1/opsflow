import type { Organization, OrganizationRole } from './organization'

export interface Inviter {
  firstName: string
  lastName: string
}

// A pending invitation, as admins see it on the members page.
export interface Invitation {
  id: string
  email: string
  role: OrganizationRole
  invitedBy: Inviter | null
  expiresAt: string
  expired: boolean
  createdAt: string
}

export interface CreatedInvitation {
  invitation: Invitation
  // Only returned when the invitation is created; it cannot be shown again.
  token: string
}

export type InvitationState =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'REVOKED'
  | 'EXPIRED'

// What the invitation link shows, also to people who are not logged in.
export interface InvitationPreview {
  email: string
  role: OrganizationRole
  state: InvitationState
  organization: { name: string }
  invitedBy: Inviter | null
  expiresAt: string
}

export type AcceptedInvitation = Organization
