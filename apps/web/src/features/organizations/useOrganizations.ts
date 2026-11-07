import { useContext } from 'react'
import {
  OrganizationsContext,
  type OrganizationsContextValue,
} from './organizations-context'

export function useOrganizations(): OrganizationsContextValue {
  const value = useContext(OrganizationsContext)

  if (!value) {
    throw new Error('useOrganizations must be used inside <OrganizationsProvider>')
  }

  return value
}
