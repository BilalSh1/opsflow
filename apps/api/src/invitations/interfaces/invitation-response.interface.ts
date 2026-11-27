import type {
  InvitationStatus,
  OrganizationRole,
} from '../../generated/prisma/client';
import type { OrganizationResponse } from '../../organizations/interfaces/organization-response.interface';

export interface InviterRef {
  firstName: string;
  lastName: string;
}

// A pending invitation, as shown to the organization's admins.
export interface InvitationResponse {
  id: string;
  email: string;
  role: OrganizationRole;
  invitedBy: InviterRef | null;
  expiresAt: string;
  expired: boolean;
  createdAt: string;
}

export interface InvitationListResponse {
  invitations: InvitationResponse[];
}

// The token is only returned here, once; the API cannot show it again.
export interface CreatedInvitationResponse {
  invitation: InvitationResponse;
  token: string;
}

export type InvitationState = InvitationStatus | 'EXPIRED';

// What the person holding the link sees before accepting.
export interface InvitationPreviewResponse {
  invitation: {
    email: string;
    role: OrganizationRole;
    state: InvitationState;
    organization: { name: string };
    invitedBy: InviterRef | null;
    expiresAt: string;
  };
}

export interface AcceptedInvitationResponse {
  organization: OrganizationResponse;
}
