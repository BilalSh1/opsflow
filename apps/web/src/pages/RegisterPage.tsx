import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { useAuth } from '../features/auth/useAuth'

export function RegisterPage() {
  const { register } = useAuth()
  const location = useLocation()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // Registering also logs the user in; GuestOnly then redirects.
      await register({ firstName, lastName, email, password })
    } catch (caught) {
      setError(errorMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create your account</h1>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="field-row">
          <TextField
            label="First name"
            autoComplete="given-name"
            required
            maxLength={100}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />

          <TextField
            label="Last name"
            autoComplete="family-name"
            required
            maxLength={100}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          maxLength={255}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </form>
    </main>
  )
}
