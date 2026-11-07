import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { redirectTarget } from './redirect-target'

// Login and register pages; signed-in users go back where they came from.
export function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p className="status">Loading…</p>
  }

  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location.state)} replace />
  }

  return <Outlet />
}
