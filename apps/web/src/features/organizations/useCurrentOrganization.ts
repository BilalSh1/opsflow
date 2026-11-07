import { useOutletContext } from 'react-router'
import type { Organization } from '../../types/organization'

export interface CurrentOrganizationContext {
  organization: Organization
  // Replaces the loaded organization, e.g. after the user's own role changed.
  updateOrganization: (organization: Organization) => void
}

// For pages rendered inside OrganizationLayout.
export function useCurrentOrganization(): CurrentOrganizationContext {
  return useOutletContext<CurrentOrganizationContext>()
}
