import type { OrganizationRole } from '../../generated/prisma/client';

export interface TeamSummaryResponse {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

// `memberId` is the organization membership id, as in the members list.
export interface TeamMemberResponse {
  memberId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrganizationRole;
  addedAt: string;
}

export interface TeamDetailResponse {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMemberResponse[];
}
