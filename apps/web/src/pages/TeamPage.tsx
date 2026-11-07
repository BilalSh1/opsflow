import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { listMembers } from '../api/members'
import {
  addTeamMember,
  deleteTeam,
  getTeam,
  removeTeamMember,
  renameTeam,
} from '../api/teams'
import { LoadError } from '../components/LoadError'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { canManageTeams, roleLabels } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useResource } from '../hooks/useResource'
import type { Member } from '../types/member'
import type { TeamMember } from '../types/team'

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`

const byName = (a: TeamMember, b: TeamMember) =>
  a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)

export function TeamPage() {
  const { teamId = '' } = useParams()
  const { organization } = useCurrentOrganization()
  const navigate = useNavigate()
  const canManage = canManageTeams(organization.role)

  const team = useResource(`${organization.id}:${teamId}`, () =>
    getTeam(organization.id, teamId),
  )
  // Only managers need the organization's members, for the add picker.
  const members = useResource(`${organization.id}:${canManage}`, () =>
    canManage ? listMembers(organization.id) : Promise.resolve<Member[]>([]),
  )

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const backLink = (
    <Link to=".." relative="path" className="back-link">
      ← All teams
    </Link>
  )

  if (team.state.status === 'loading') {
    return <p className="status">Loading team…</p>
  }

  if (team.state.status === 'error') {
    const { error: loadError } = team.state

    if (loadError instanceof ApiError && loadError.status === 404) {
      return (
        <div className="panel">
          {backLink}
          <h2>Team not found</h2>
          <p className="muted">It may have been deleted.</p>
        </div>
      )
    }

    return <LoadError message="Could not load this team." onRetry={team.reload} />
  }

  const current = team.state.data

  // Runs a change, showing any API error at the top of the page. Resolves
  // to whether it succeeded.
  async function run(action: () => Promise<void>): Promise<boolean> {
    setError(null)
    setBusy(true)

    try {
      await action()
      return true
    } catch (caught) {
      setError(errorMessage(caught))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the team ${current.name}? Its members stay in the organization.`)) {
      return
    }

    await run(async () => {
      await deleteTeam(organization.id, current.id)
      navigate('..', { relative: 'path', replace: true })
    })
  }

  function handleRemove(member: TeamMember) {
    if (!window.confirm(`Remove ${fullName(member)} from ${current.name}?`)) {
      return
    }

    return run(async () => {
      await removeTeamMember(organization.id, current.id, member.memberId)
      team.update((detail) => ({
        ...detail,
        members: detail.members.filter((item) => item.memberId !== member.memberId),
      }))
    })
  }

  const inTeam = new Set(current.members.map((member) => member.memberId))
  const candidates =
    members.state.status === 'ready'
      ? members.state.data.filter((member) => !inTeam.has(member.id))
      : []

  return (
    <div className="team">
      {backLink}

      {canManage ? (
        <TeamHeader
          name={current.name}
          busy={busy}
          onRename={(name) =>
            run(async () => {
              const renamed = await renameTeam(organization.id, current.id, name)
              team.update((detail) => ({ ...detail, name: renamed.name }))
            })
          }
          onDelete={handleDelete}
        />
      ) : (
        <h2>{current.name}</h2>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {canManage && members.state.status === 'ready' && (
        <AddTeamMemberForm
          candidates={candidates}
          busy={busy}
          onAdd={(memberId) =>
            run(async () => {
              const added = await addTeamMember(organization.id, current.id, memberId)
              team.update((detail) => ({
                ...detail,
                members: [...detail.members, added].sort(byName),
              }))
            })
          }
        />
      )}

      {current.members.length === 0 ? (
        <p className="muted">No one is in this team yet.</p>
      ) : (
        <table className="members-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {current.members.map((member) => (
              <tr key={member.memberId}>
                <td data-label="Name">{fullName(member)}</td>
                <td data-label="Email">{member.email}</td>
                <td data-label="Role">{roleLabels[member.role]}</td>
                <td className="members-actions">
                  {canManage && (
                    <button
                      type="button"
                      className="secondary danger"
                      aria-label={`Remove ${fullName(member)} from team`}
                      disabled={busy}
                      onClick={() => handleRemove(member)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function TeamHeader({
  name,
  busy,
  onRename,
  onDelete,
}: {
  name: string
  busy: boolean
  onRename: (name: string) => Promise<boolean>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Stay in edit mode on failure so the typed name is not lost.
    if (await onRename(draft)) {
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <form className="inline-form-fields" onSubmit={handleSubmit}>
        <TextField
          label="Team name"
          required
          maxLength={100}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={busy}>
          Save
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setDraft(name)
            setEditing(false)
          }}
        >
          Cancel
        </button>
      </form>
    )
  }

  return (
    <div className="team-header">
      <h2>{name}</h2>
      <div className="form-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setDraft(name)
            setEditing(true)
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className="secondary danger"
          disabled={busy}
          onClick={onDelete}
        >
          Delete team
        </button>
      </div>
    </div>
  )
}

function AddTeamMemberForm({
  candidates,
  busy,
  onAdd,
}: {
  candidates: Member[]
  busy: boolean
  onAdd: (memberId: string) => Promise<boolean>
}) {
  const [selected, setSelected] = useState('')
  const value = candidates.some((member) => member.id === selected)
    ? selected
    : ''

  if (candidates.length === 0) {
    return (
      <p className="muted">Everyone in the organization is already in this team.</p>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (value && (await onAdd(value))) {
      setSelected('')
    }
  }

  return (
    <form className="inline-form-fields" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="add-team-member">Add a member</label>
        <select
          id="add-team-member"
          value={value}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="" disabled>
            Choose someone…
          </option>
          {candidates.map((member) => (
            <option key={member.id} value={member.id}>
              {fullName(member)} ({member.email})
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={busy || !value}>
        Add to team
      </button>
    </form>
  )
}
