import { createContext } from 'react'
import type { Organization } from '../../types/organization'

export type OrganizationsStatus = 'loading' | 'ready' | 'error'

export interface OrganizationsContextValue {
  status: OrganizationsStatus
  organizations: Organization[]
  reload: () => void
  addOrganization: (organization: Organization) => void
  removeOrganization: (organizationId: string) => void
}

export const OrganizationsContext =
  createContext<OrganizationsContextValue | null>(null)
