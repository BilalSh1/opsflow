import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { createOrganization } from '../api/organizations'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { useOrganizations } from '../features/organizations/useOrganizations'

export function CreateOrganizationPage() {
  const { status, organizations, addOrganization } = useOrganizations()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isFirst = status === 'ready' && organizations.length === 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const organization = await createOrganization(name)
      addOrganization(organization)
      navigate(`/organizations/${organization.id}`)
    } catch (caught) {
      setError(errorMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h1>{isFirst ? 'Create your first organization' : 'New organization'}</h1>
      <p className="muted">
        An organization is the workspace your team shares. You will be its
        owner.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <TextField
        label="Organization name"
        required
        maxLength={100}
        placeholder="Acme Technologies"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create organization'}
        </button>
        {!isFirst && <Link to="/">Cancel</Link>}
      </div>
    </form>
  )
}
