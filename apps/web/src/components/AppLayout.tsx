import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { OrganizationSwitcher } from '../features/organizations/OrganizationSwitcher'
import { OrganizationsProvider } from '../features/organizations/OrganizationsProvider'

// Shell for every signed-in page.
export function AppLayout() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  return (
    <OrganizationsProvider>
      <div className="app-shell">
        <header className="app-header">
          <Link to="/" className="brand">
            OpsFlow
          </Link>

          <OrganizationSwitcher />

          <nav className="app-header-actions">
            <Link to="/organizations/new">New organization</Link>
            <span className="app-header-user">{user?.firstName}</span>
            <button
              type="button"
              className="secondary"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </nav>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </OrganizationsProvider>
  )
}
