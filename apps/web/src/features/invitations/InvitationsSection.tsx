import { useState, type FormEvent } from 'react'
import {
  createInvitation,
  invitationLink,
  listInvitations,
  revokeInvitation,
} from '../../api/invitations'
import { LoadError } from '../../components/LoadError'
import { TextField } from '../../components/TextField'
import { useResource } from '../../hooks/useResource'
import type { Invitation } from '../../types/invitation'
import type { OrganizationRole } from '../../types/organization'
import { errorMessage } from '../auth/error-message'
import { grantableRoles, roleLabels } from '../organizations/permissions'

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })

// The invite form and pending invitations, for owners and admins.
export function InvitationsSection({
  organizationId,
  actorRole,
}: {
  organizationId: string
  actorRole: OrganizationRole
}) {
  const invitations = useResource(organizationId, () =>
    listInvitations(organizationId),
  )
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleRevoke(invitation: Invitation) {
    if (!window.confirm(`Revoke the invitation for ${invitation.email}?`)) {
      return
    }

    setError(null)
    setBusyId(invitation.id)

    try {
      await revokeInvitation(organizationId, invitation.id)
      invitations.update((current) =>
        current.filter((item) => item.id !== invitation.id),
      )
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <InviteForm
        actorRole={actorRole}
        onInvite={async (email, role) => {
          const created = await createInvitation(organizationId, email, role)
          // Inviting the same email again replaces its pending invitation.
          invitations.update((current) => [
            created.invitation,
            ...current.filter((item) => item.id !== created.invitation.id),
          ])
          return created.token
        }}
      />

      {invitations.state.status === 'error' && (
        <LoadError
          message="Could not load the pending invitations."
          onRetry={invitations.reload}
        />
      )}

      {invitations.state.status === 'ready' &&
        invitations.state.data.length > 0 && (
          <section className="pending-invitations">
            <h2>Pending invitations</h2>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <table className="members-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Expires</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.state.data.map((invitation) => (
                  <tr key={invitation.id}>
                    <td data-label="Email">{invitation.email}</td>
                    <td data-label="Role">{roleLabels[invitation.role]}</td>
                    <td data-label="Expires">
                      {invitation.expired
                        ? 'Expired'
                        : formatDate(invitation.expiresAt)}
                    </td>
                    <td className="members-actions">
                      <button
                        type="button"
                        className="secondary danger"
                        aria-label={`Revoke invitation for ${invitation.email}`}
                        disabled={busyId === invitation.id}
                        onClick={() => handleRevoke(invitation)}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
    </>
  )
}

function InviteForm({
  actorRole,
  onInvite,
}: {
  actorRole: OrganizationRole
  // Resolves to the token of the new invitation link.
  onInvite: (email: string, role: OrganizationRole) => Promise<string>
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrganizationRole>('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{
    email: string
    link: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setCreated(null)
    setCopied(false)
    setSubmitting(true)

    try {
      const token = await onInvite(email, role)
      setCreated({ email: email.trim(), link: invitationLink(token) })
      setEmail('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError('Could not copy the link. Select it and copy it instead.')
    }
  }

  return (
    <form className="add-member" onSubmit={handleSubmit}>
      <h2>Invite people</h2>
      <p className="muted">
        You get a link to send them. It works once and expires after 7 days.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {created && (
        <div className="invite-link" role="status">
          <p className="form-success">
            Invitation for {created.email} created. Send them this link; it
            is shown only once.
          </p>
          <div className="invite-link-row">
            <input
              aria-label="Invitation link"
              readOnly
              value={created.link}
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => handleCopy(created.link)}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
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
          <label htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
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
          {submitting ? 'Inviting…' : 'Invite'}
        </button>
      </div>
    </form>
  )
}
