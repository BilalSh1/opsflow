import type { OrganizationRole } from '../../generated/prisma/client';

export interface MemberResponse {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrganizationRole;
  joinedAt: string;
}

export interface MemberDetailResponse {
  member: MemberResponse;
}

export interface MemberListResponse {
  members: MemberResponse[];
}
