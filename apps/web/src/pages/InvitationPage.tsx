import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import {
  acceptInvitation,
  declineInvitation,
  getInvitation,
} from '../api/invitations'
import { ApiError } from '../api/client'
import { LoadError } from '../components/LoadError'
import { errorMessage } from '../features/auth/error-message'
import { useAuth } from '../features/auth/useAuth'
import { roleLabels } from '../features/organizations/permissions'
import { useResource } from '../hooks/useResource'
import type { InvitationPreview, InvitationState } from '../types/invitation'

const closedMessages: Record<Exclude<InvitationState, 'PENDING'>, string> = {
  ACCEPTED: 'This invitation has already been accepted.',
  DECLINED: 'This invitation was declined.',
  REVOKED: 'This invitation was withdrawn.',
  EXPIRED: 'This invitation has expired.',
}

// Opened from an invitation link, logged in or not.
export function InvitationPage() {
  const { token = '' } = useParams()
  const invitation = useResource(token, () => getInvitation(token))

  let content
  switch (invitation.state.status) {
    case 'loading':
      content = <p className="status">Loading invitation…</p>
      break
    case 'error':
      content =
        invitation.state.error instanceof ApiError &&
        invitation.state.error.status === 404 ? (
          <InvalidLink message="This invitation link is not valid." />
        ) : (
          <LoadError
            message="Could not load the invitation."
            onRetry={invitation.reload}
          />
        )
      break
    case 'ready':
      content = (
        <InvitationDetails
          token={token}
          invitation={invitation.state.data}
          onResponded={invitation.reload}
        />
      )
  }

  return (
    <main className="auth-page">
      <div className="auth-card">{content}</div>
    </main>
  )
}

function InvalidLink({ message }: { message: string }) {
  return (
    <>
      <h1>Invitation</h1>
      <p>{message}</p>
      <p className="muted">Ask the person who invited you for a new link.</p>
      <Link to="/">Go to OpsFlow</Link>
    </>
  )
}

function InvitationDetails({
  token,
  invitation,
  onResponded,
}: {
  token: string
  invitation: InvitationPreview
  onResponded: () => void
}) {
  const { status, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (invitation.state !== 'PENDING') {
    return <InvalidLink message={closedMessages[invitation.state]} />
  }

  const inviter = invitation.invitedBy
    ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`
    : 'Someone'
  // Brings the user back here after logging in or signing up.
  const returnHere = { from: location.pathname }

  async function respond(action: 'accept' | 'decline') {
    setError(null)
    setBusy(true)

    try {
      if (action === 'accept') {
        const organization = await acceptInvitation(token)
        navigate(`/organizations/${organization.id}`, { replace: true })
        return
      }

      await declineInvitation(token)
      onResponded()
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  const declineButton = (
    <button
      type="button"
      className="secondary"
      disabled={busy}
      onClick={() => respond('decline')}
    >
      Decline
    </button>
  )

  return (
    <>
      <h1>Join {invitation.organization.name}</h1>
      <p>
        {inviter} invited <strong>{invitation.email}</strong> to join{' '}
        {invitation.organization.name} as{' '}
        {roleLabels[invitation.role].toLowerCase()}.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {status === 'loading' && <p className="status">Loading…</p>}

      {status === 'unauthenticated' && (
        <>
          <p className="muted">
            Log in or create an account with {invitation.email} to accept.
          </p>
          <div className="invitation-actions">
            <Link className="button-link" to="/register" state={returnHere}>
              Create account
            </Link>
            <Link className="button-link secondary" to="/login" state={returnHere}>
              Log in
            </Link>
            {declineButton}
          </div>
        </>
      )}

      {status === 'authenticated' && user?.email === invitation.email && (
        <div className="invitation-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => respond('accept')}
          >
            {busy ? 'Joining…' : 'Accept invitation'}
          </button>
          {declineButton}
        </div>
      )}

      {status === 'authenticated' && user?.email !== invitation.email && (
        <>
          <p className="muted">
            You are logged in as {user?.email}. Log in as {invitation.email}{' '}
            to accept this invitation.
          </p>
          <div className="invitation-actions">
            <button type="button" className="secondary" onClick={logout}>
              Log out
            </button>
          </div>
        </>
      )}
    </>
  )
}
