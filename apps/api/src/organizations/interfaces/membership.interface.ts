import type {
  Organization,
  OrganizationMember,
} from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

export type MembershipWithOrganization = OrganizationMember & {
  organization: Organization;
};

export interface OrganizationRequest extends AuthenticatedRequest {
  membership?: MembershipWithOrganization;
}
