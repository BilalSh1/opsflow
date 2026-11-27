import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { deleteOrganization, renameOrganization } from '../api/organizations'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import {
  canDeleteOrganization,
  canManageOrganization,
} from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useOrganizations } from '../features/organizations/useOrganizations'

export function SettingsPage() {
  const { organization } = useCurrentOrganization()

  if (!canManageOrganization(organization.role)) {
    return (
      <p className="muted">
        Only owners and admins can change the organization settings.
      </p>
    )
  }

  // Keyed so the forms start fresh when switching organizations.
  return (
    <div className="settings" key={organization.id}>
      <RenameForm />
      {canDeleteOrganization(organization.role) && <DeleteOrganization />}
    </div>
  )
}

function RenameForm() {
  const { organization, updateOrganization } = useCurrentOrganization()
  const { replaceOrganization } = useOrganizations()
  const [name, setName] = useState(organization.name)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaved(false)
    setSubmitting(true)

    try {
      const renamed = await renameOrganization(organization.id, name)
      updateOrganization(renamed)
      replaceOrganization(renamed)
      setName(renamed.name)
      setSaved(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="settings-section" onSubmit={handleSubmit}>
      <h2>Name</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="form-success" role="status">
          The organization was renamed.
        </p>
      )}

      <TextField
        label="Organization name"
        required
        maxLength={100}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <div className="form-actions">
        <button
          type="submit"
          disabled={submitting || name.trim() === organization.name}
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

// Asks for the organization name before deleting, as it cannot be undone.
function DeleteOrganization() {
  const { organization } = useCurrentOrganization()
  const { removeOrganization } = useOrganizations()
  const navigate = useNavigate()
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmed = confirmation.trim() === organization.name

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!confirmed) {
      return
    }

    setError(null)
    setDeleting(true)

    try {
      await deleteOrganization(organization.id)
      removeOrganization(organization.id)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
      setDeleting(false)
    }
  }

  return (
    <form className="settings-section danger-zone" onSubmit={handleSubmit}>
      <h2>Delete organization</h2>
      <p className="muted">
        This permanently deletes {organization.name} with all of its
        incidents, comments, teams, projects, members and invitations. It
        cannot be undone.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <TextField
        label={`Type ${organization.name} to confirm`}
        autoComplete="off"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />

      <div className="form-actions">
        <button
          type="submit"
          className="secondary danger"
          disabled={!confirmed || deleting}
        >
          {deleting ? 'Deleting…' : 'Delete organization'}
        </button>
      </div>
    </form>
  )
}
