import { Navigate } from 'react-router'
import { LoadError } from '../components/LoadError'
import { useAuth } from '../features/auth/useAuth'
import { readLastOrganizationId } from '../features/organizations/last-organization'
import { useOrganizations } from '../features/organizations/useOrganizations'

// "/" opens the last organization used here, else the newest one, else the
// create page.
export function HomeRedirect() {
  const { user } = useAuth()
  const { status, organizations, reload } = useOrganizations()

  if (status === 'loading') {
    return <p className="status">Loading…</p>
  }

  if (status === 'error') {
    return (
      <LoadError message="Could not load your organizations." onRetry={reload} />
    )
  }

  if (organizations.length === 0) {
    return <Navigate to="/organizations/new" replace />
  }

  const lastId = user ? readLastOrganizationId(user.id) : null
  const target =
    organizations.find((organization) => organization.id === lastId) ??
    organizations[0]

  return <Navigate to={`/organizations/${target.id}`} replace />
}
