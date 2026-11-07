import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  addMember,
  listMembers,
  removeMember,
  updateMemberRole,
} from '../api/members'
import { LoadError } from '../components/LoadError'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { useAuth } from '../features/auth/useAuth'
import {
  canManageMember,
  canManageMembers,
  grantableRoles,
  roleLabels,
  ROLES,
} from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useOrganizations } from '../features/organizations/useOrganizations'
import type { Member } from '../types/member'
import type { OrganizationRole } from '../types/organization'

// Same order as the API: by role, then name.
function sortMembers(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) =>
      ROLES.indexOf(a.role) - ROLES.indexOf(b.role) ||
      a.firstName.localeCompare(b.firstName) ||
      a.lastName.localeCompare(b.lastName),
  )
}

export function MembersPage() {
  const { organization, updateOrganization } = useCurrentOrganization()
  const { user } = useAuth()
  const { removeOrganization } = useOrganizations()
  const navigate = useNavigate()

  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{
    key: string
    members: Member[] | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)

  const key = `${organization.id}:${attempt}`

  useEffect(() => {
    let active = true

    listMembers(organization.id).then(
      (members) => {
        if (active) {
          setLoaded({ key, members })
        }
      },
      () => {
        if (active) {
          setLoaded({ key, members: null })
        }
      },
    )

    return () => {
      active = false
    }
  }, [organization.id, key])

  if (loaded?.key !== key) {
    return <p className="status">Loading members…</p>
  }

  if (!loaded.members) {
    return (
      <LoadError
        message="Could not load the members."
        onRetry={() => setAttempt((current) => current + 1)}
      />
    )
  }

  const members = loaded.members
  const actorRole = organization.role
  const setMembers = (next: Member[]) =>
    setLoaded({ key, members: sortMembers(next) })

  async function handleRoleChange(member: Member, role: OrganizationRole) {
    setError(null)
    setBusyMemberId(member.id)

    try {
      const updated = await updateMemberRole(organization.id, member.id, role)
      setMembers(members.map((item) => (item.id === updated.id ? updated : item)))

      if (updated.userId === user?.id) {
        updateOrganization({ ...organization, role: updated.role })
      }
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusyMemberId(null)
    }
  }

  async function handleRemove(member: Member) {
    const isSelf = member.userId === user?.id
    const question = isSelf
      ? `Leave ${organization.name}? You will lose access to it.`
      : `Remove ${member.firstName} ${member.lastName} from ${organization.name}?`

    if (!window.confirm(question)) {
      return
    }

    setError(null)
    setBusyMemberId(member.id)

    try {
      await removeMember(organization.id, member.id)

      if (isSelf) {
        removeOrganization(organization.id)
        navigate('/', { replace: true })
        return
      }

      setMembers(members.filter((item) => item.id !== member.id))
    } catch (caught) {
      setError(errorMessage(caught))
    }

    setBusyMemberId(null)
  }

  return (
    <div className="members">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {canManageMembers(actorRole) && (
        <AddMemberForm
          actorRole={actorRole}
          onAdd={async (email, role) => {
            const member = await addMember(organization.id, email, role)
            setMembers([...members, member])
            return member
          }}
        />
      )}

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
          {members.map((member) => {
            const isSelf = member.userId === user?.id
            const fullName = `${member.firstName} ${member.lastName}`
            const editable = canManageMember(actorRole, member.role)
            const busy = busyMemberId === member.id

            return (
              <tr key={member.id}>
                <td data-label="Name">
                  {fullName}
                  {isSelf && <span className="muted"> (you)</span>}
                </td>
                <td data-label="Email">{member.email}</td>
                <td data-label="Role">
                  {editable ? (
                    <select
                      aria-label={`Role for ${fullName}`}
                      value={member.role}
                      disabled={busy}
                      onChange={(event) =>
                        handleRoleChange(
                          member,
                          event.target.value as OrganizationRole,
                        )
                      }
                    >
                      {grantableRoles(actorRole).map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roleLabels[member.role]
                  )}
                </td>
                <td className="members-actions">
                  {isSelf ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => handleRemove(member)}
                    >
                      Leave organization
                    </button>
                  ) : (
                    editable && (
                      <button
                        type="button"
                        className="secondary danger"
                        aria-label={`Remove ${fullName}`}
                        disabled={busy}
                        onClick={() => handleRemove(member)}
                      >
                        Remove
                      </button>
                    )
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AddMemberForm({
  actorRole,
  onAdd,
}: {
  actorRole: OrganizationRole
  onAdd: (email: string, role: OrganizationRole) => Promise<Member>
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrganizationRole>('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setAdded(null)
    setSubmitting(true)

    try {
      const member = await onAdd(email, role)
      setAdded(`${member.firstName} ${member.lastName} was added.`)
      setEmail('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="add-member" onSubmit={handleSubmit}>
      <h2>Add a member</h2>
      <p className="muted">They need an OpsFlow account already.</p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {added && (
        <p className="form-success" role="status">
          {added}
        </p>
      )}

      <div className="add-member-fields">
        <TextField
          label="Email"
          type="email"
          required
          maxLength={255}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div className="field">
          <label htmlFor="add-member-role">Role</label>
          <select
            id="add-member-role"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as OrganizationRole)
            }
          >
            {grantableRoles(actorRole).map((option) => (
              <option key={option} value={option}>
                {roleLabels[option]}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add member'}
        </button>
      </div>
    </form>
  )
}
