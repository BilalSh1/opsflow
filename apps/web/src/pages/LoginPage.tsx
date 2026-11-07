import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { useAuth } from '../features/auth/useAuth'

export function LoginPage() {
  const { login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // On success GuestOnly redirects to the page the user came from.
      await login({ email, password })
    } catch (caught) {
      setError(errorMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Log in to OpsFlow</h1>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="auth-switch">
          No account yet?{' '}
          <Link to="/register" state={location.state}>
            Create one
          </Link>
        </p>
      </form>
    </main>
  )
}
