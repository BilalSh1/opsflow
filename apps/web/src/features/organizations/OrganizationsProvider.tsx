import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listOrganizations } from '../../api/organizations'
import type { Organization } from '../../types/organization'
import {
  OrganizationsContext,
  type OrganizationsContextValue,
  type OrganizationsStatus,
} from './organizations-context'

interface LoadResult {
  // Which load this result belongs to; a newer request means "loading".
  request: number
  status: Exclude<OrganizationsStatus, 'loading'>
  organizations: Organization[]
}

// Loads the signed-in user's organizations once; mounted only for signed-in
// pages, so it reloads after every login.
export function OrganizationsProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)

  useEffect(() => {
    let active = true

    listOrganizations().then(
      (organizations) => {
        if (active) {
          setResult({ request, status: 'ready', organizations })
        }
      },
      () => {
        if (active) {
          setResult({ request, status: 'error', organizations: [] })
        }
      },
    )

    return () => {
      active = false
    }
  }, [request])

  const reload = useCallback(() => setRequest((current) => current + 1), [])

  const addOrganization = useCallback((organization: Organization) => {
    setResult((current) =>
      current
        ? {
            ...current,
            organizations: [
              organization,
              ...current.organizations.filter(
                (existing) => existing.id !== organization.id,
              ),
            ],
          }
        : current,
    )
  }, [])

  const removeOrganization = useCallback((organizationId: string) => {
    setResult((current) =>
      current
        ? {
            ...current,
            organizations: current.organizations.filter(
              (existing) => existing.id !== organizationId,
            ),
          }
        : current,
    )
  }, [])

  const value = useMemo<OrganizationsContextValue>(() => {
    const current = result?.request === request ? result : null

    return {
      status: current?.status ?? 'loading',
      organizations: current?.organizations ?? [],
      reload,
      addOrganization,
      removeOrganization,
    }
  }, [result, request, reload, addOrganization, removeOrganization])

  return (
    <OrganizationsContext.Provider value={value}>
      {children}
    </OrganizationsContext.Provider>
  )
}
