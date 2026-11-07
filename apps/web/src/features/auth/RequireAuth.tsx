import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { status, loggedOut } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p className="status">Loading…</p>
  }

  // Remember the page for after login, unless the user logged out on
  // purpose: the next person to log in should start from their own home.
  if (status === 'unauthenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={loggedOut ? undefined : { from: location.pathname }}
      />
    )
  }

  return <Outlet />
}
