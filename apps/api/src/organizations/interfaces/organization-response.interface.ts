import type { OrganizationRole } from '../../generated/prisma/client';

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
  createdAt: string;
}

export interface OrganizationDetailResponse {
  organization: OrganizationResponse;
}

export interface OrganizationListResponse {
  organizations: OrganizationResponse[];
}
