import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { createTeam, listTeams } from '../api/teams'
import { LoadError } from '../components/LoadError'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { canManageTeams } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useResource } from '../hooks/useResource'
import type { TeamSummary } from '../types/team'

const byName = (a: TeamSummary, b: TeamSummary) => a.name.localeCompare(b.name)

export function TeamsPage() {
  const { organization } = useCurrentOrganization()
  const teams = useResource(organization.id, () => listTeams(organization.id))

  if (teams.state.status === 'loading') {
    return <p className="status">Loading teams…</p>
  }

  if (teams.state.status === 'error') {
    return <LoadError message="Could not load the teams." onRetry={teams.reload} />
  }

  const list = teams.state.data

  return (
    <div className="teams">
      {canManageTeams(organization.role) && (
        <CreateTeamForm
          onCreate={async (name) => {
            const team = await createTeam(organization.id, name)
            teams.update((current) => [...current, team].sort(byName))
          }}
        />
      )}

      {list.length === 0 ? (
        <p className="muted">No teams yet.</p>
      ) : (
        <ul className="team-list">
          {list.map((team) => (
            <li key={team.id}>
              <Link to={team.id}>{team.name}</Link>
              <span className="muted">
                {team.memberCount === 1
                  ? '1 member'
                  : `${team.memberCount} members`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateTeamForm({
  onCreate,
}: {
  onCreate: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await onCreate(name)
      setName('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <h2>Create a team</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="inline-form-fields">
        <TextField
          label="Team name"
          required
          maxLength={100}
          placeholder="Engineering"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create team'}
        </button>
      </div>
    </form>
  )
}
