import { useState } from 'react'
import { useAuth } from '../features/auth/useAuth'

export function HomePage() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">OpsFlow</span>
        <button
          type="button"
          className="secondary"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </header>

      <main className="app-main">
        <h1>Welcome, {user?.firstName}</h1>
        <p>Signed in as {user?.email}.</p>
      </main>
    </div>
  )
}
