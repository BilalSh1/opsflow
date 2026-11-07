import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { getOrganization } from '../api/organizations'
import { LoadError } from '../components/LoadError'
import { useAuth } from '../features/auth/useAuth'
import { rememberLastOrganizationId } from '../features/organizations/last-organization'
import type { Organization, OrganizationRole } from '../types/organization'

type LoadResult =
  | { status: 'ready'; organization: Organization }
  | { status: 'not-found' }
  | { status: 'error' }

const roleLabels: Record<OrganizationRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}

export function OrganizationPage() {
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

  if (result.status === 'error') {
    return (
      <LoadError
        message="Could not load this organization."
        onRetry={() => setAttempt((current) => current + 1)}
      />
    )
  }

  const { organization } = result

  return (
    <section>
      <h1>{organization.name}</h1>

      <dl className="details">
        <dt>Slug</dt>
        <dd>{organization.slug}</dd>

        <dt>Your role</dt>
        <dd>{roleLabels[organization.role]}</dd>

        <dt>Created</dt>
        <dd>
          {new Date(organization.createdAt).toLocaleDateString(undefined, {
            dateStyle: 'medium',
          })}
        </dd>
      </dl>
    </section>
  )
}
