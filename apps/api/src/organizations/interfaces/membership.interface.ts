import type {
  Organization,
  OrganizationMember,
  User,
} from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

export type MembershipWithOrganization = OrganizationMember & {
  organization: Organization;
};

export type MemberWithUser = OrganizationMember & {
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
};

export interface OrganizationRequest extends AuthenticatedRequest {
  membership?: MembershipWithOrganization;
}
