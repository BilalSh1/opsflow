import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { getOrganization } from '../api/organizations'
import { LoadError } from '../components/LoadError'
import { useAuth } from '../features/auth/useAuth'
import { rememberLastOrganizationId } from '../features/organizations/last-organization'
import type { CurrentOrganizationContext } from '../features/organizations/useCurrentOrganization'
import type { Organization } from '../types/organization'

type LoadResult =
  | { status: 'ready'; organization: Organization }
  | { status: 'not-found' }
  | { status: 'error' }

// Loads the organization in the URL once for all of its tabs.
export function OrganizationLayout() {
  const { organizationId = '' } = useParams()
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  // Tagged with the id and attempt it was loaded for, so a stale result
  // reads as "loading" without resetting state inside the effect.
  const [loaded, setLoaded] = useState<{
    key: string
    result: LoadResult
  } | null>(null)

  const key = `${organizationId}:${attempt}`

  useEffect(() => {
    let active = true

    getOrganization(organizationId).then(
      (organization) => {
        if (active) {
          setLoaded({ key, result: { status: 'ready', organization } })
        }
      },
      (error: unknown) => {
        if (active) {
          const notFound =
            error instanceof ApiError &&
            (error.status === 404 || error.status === 400)

          setLoaded({
            key,
            result: notFound ? { status: 'not-found' } : { status: 'error' },
          })
        }
      },
    )

    return () => {
      active = false
    }
  }, [organizationId, key])

  const result = loaded?.key === key ? loaded.result : null

  useEffect(() => {
    if (user && result?.status === 'ready') {
      rememberLastOrganizationId(user.id, result.organization.id)
    }
  }, [user, result])

  const updateOrganization = useCallback(
    (organization: Organization) =>
      setLoaded({ key, result: { status: 'ready', organization } }),
    [key],
  )

  const context = useMemo<CurrentOrganizationContext | null>(
    () =>
      result?.status === 'ready'
        ? { organization: result.organization, updateOrganization }
        : null,
    [result, updateOrganization],
  )

  if (!result) {
    return <p className="status">Loading…</p>
  }

  if (result.status === 'not-found') {
    return (
      <div className="panel">
        <h1>Organization not found</h1>
        <p className="muted">
          It may not exist, or you may not be a member of it.
        </p>
        <Link to="/">Go to your organizations</Link>
      </div>
    )
  }

  if (result.status === 'error' || !context) {
    return (
      <LoadError
        message="Could not load this organization."
        onRetry={() => setAttempt((current) => current + 1)}
      />
    )
  }

  return (
    <section>
      <h1>{context.organization.name}</h1>

      <nav className="tabs" aria-label="Organization">
        <NavLink to="." end>
          Overview
        </NavLink>
        <NavLink to="members">Members</NavLink>
      </nav>

      <Outlet context={context} />
    </section>
  )
}
