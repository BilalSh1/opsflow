import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import {
  addComment,
  deleteComment,
  editComment,
  getIncident,
  listActivity,
  listComments,
  updateIncident,
} from '../api/incidents'
import { PriorityBadge, StatusBadge } from '../components/IncidentBadges'
import { LoadError } from '../components/LoadError'
import { TextAreaField } from '../components/TextAreaField'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { useAuth } from '../features/auth/useAuth'
import {
  describeActivity,
  formatDateTime,
  incidentKey,
  personName,
  PRIORITIES,
  priorityLabels,
  statusLabels,
} from '../features/incidents/labels'
import { useIncidentOptions } from '../features/incidents/useIncidentOptions'
import { canWorkOnIncidents } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useResource } from '../hooks/useResource'
import type {
  IncidentActivity,
  IncidentComment,
  IncidentDetail,
  IncidentInput,
  IncidentPriority,
  IncidentStatus,
} from '../types/incident'

type TimelineEntry =
  | { kind: 'comment'; at: string; comment: IncidentComment }
  | { kind: 'activity'; at: string; activity: IncidentActivity }

// Comments and changes in time order. "Comment added" entries are left out
// because the comment itself is shown.
function buildTimeline(
  comments: IncidentComment[],
  activity: IncidentActivity[],
): TimelineEntry[] {
  return [
    ...comments.map(
      (comment): TimelineEntry => ({ kind: 'comment', at: comment.createdAt, comment }),
    ),
    ...activity
      .filter((entry) => entry.type !== 'COMMENT_ADDED')
      .map(
        (entry): TimelineEntry => ({ kind: 'activity', at: entry.createdAt, activity: entry }),
      ),
  ].sort((a, b) => a.at.localeCompare(b.at))
}

export function IncidentPage() {
  const { number: numberParam = '' } = useParams()
  const number = Number(numberParam)
  const { organization } = useCurrentOrganization()
  const { user } = useAuth()
  const options = useIncidentOptions(organization.id)
  const canWork = canWorkOnIncidents(organization.role)

  const key = `${organization.id}:${numberParam}`
  const incident = useResource(key, () => getIncident(organization.id, number))
  const activity = useResource(key, () => listActivity(organization.id, number))
  const comments = useResource(key, () => listComments(organization.id, number))

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  const backLink = (
    <Link to=".." relative="path" className="back-link">
      ← All incidents
    </Link>
  )

  if (incident.state.status === 'loading') {
    return <p className="status">Loading incident…</p>
  }

  if (incident.state.status === 'error') {
    const { error: loadError } = incident.state

    if (loadError instanceof ApiError && loadError.status === 404) {
      return (
        <div className="panel">
          {backLink}
          <h2>Incident not found</h2>
          <p className="muted">Check the incident number and try again.</p>
        </div>
      )
    }

    return (
      <LoadError message="Could not load this incident." onRetry={incident.reload} />
    )
  }

  const current = incident.state.data
  const closed = current.status === 'CLOSED'
  const canEditFields = canWork && !closed

  // Runs a change, showing any API error. Resolves to whether it succeeded.
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

  const change = (input: IncidentInput) =>
    run(async () => {
      const updated = await updateIncident(organization.id, number, input)
      incident.update(() => updated)
      activity.reload()
    })

  return (
    <div className="incident">
      {backLink}

      {editing ? (
        <EditIncidentForm
          incident={current}
          busy={busy}
          error={error}
          onCancel={() => {
            setError(null)
            setEditing(false)
          }}
          onSave={async (input) => {
            if (await change(input)) {
              setEditing(false)
            }
          }}
        />
      ) : (
        <>
          <header className="incident-header">
            <div>
              <span className="incident-key">{incidentKey(current.number)}</span>
              <h2>{current.title}</h2>
            </div>
            <div className="form-actions">
              <StatusBadge status={current.status} />
              <PriorityBadge priority={current.priority} />
              {canEditFields && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setError(null)
                    setEditing(true)
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          </header>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}

      <div className="incident-layout">
        <section className="incident-main" aria-label="Description and timeline">
          {!editing && (
            <p className={current.description ? 'project-body' : 'muted'}>
              {current.description ?? 'No description.'}
            </p>
          )}

          <h3>Timeline</h3>
          {activity.state.status === 'ready' && comments.state.status === 'ready' ? (
            <ol className="timeline">
              {buildTimeline(comments.state.data, activity.state.data).map((entry) =>
                entry.kind === 'comment' ? (
                  <CommentItem
                    key={`c-${entry.comment.id}`}
                    comment={entry.comment}
                    own={entry.comment.author?.userId === user?.id && canWork}
                    onEdit={(content) =>
                      run(async () => {
                        const edited = await editComment(
                          organization.id,
                          number,
                          entry.comment.id,
                          content,
                        )
                        comments.update((list) =>
                          list.map((item) => (item.id === edited.id ? edited : item)),
                        )
                      })
                    }
                    onDelete={() => {
                      if (!window.confirm('Delete this comment?')) {
                        return
                      }

                      void run(async () => {
                        await deleteComment(organization.id, number, entry.comment.id)
                        comments.update((list) =>
                          list.filter((item) => item.id !== entry.comment.id),
                        )
                      })
                    }}
                  />
                ) : (
                  <li key={`a-${entry.activity.id}`} className="timeline-activity">
                    <span>{describeActivity(entry.activity)}</span>
                    <time className="muted" dateTime={entry.at}>
                      {formatDateTime(entry.at)}
                    </time>
                  </li>
                ),
              )}
            </ol>
          ) : activity.state.status === 'error' || comments.state.status === 'error' ? (
            <LoadError
              message="Could not load the timeline."
              onRetry={() => {
                activity.reload()
                comments.reload()
              }}
            />
          ) : (
            <p className="status">Loading timeline…</p>
          )}

          {canWork && (
            <CommentForm
              busy={busy}
              onSubmit={(content) =>
                run(async () => {
                  const comment = await addComment(organization.id, number, content)
                  comments.update((list) => [...list, comment])
                  // Commenting counts as an update; refresh "Updated" quietly.
                  const fresh = await getIncident(organization.id, number)
                  incident.update(() => fresh)
                })
              }
            />
          )}
        </section>

        <aside className="incident-details" aria-label="Details">
          <DetailRow label="Status">
            {canWork ? (
              <select
                aria-label="Status"
                value={current.status}
                disabled={busy}
                onChange={(event) =>
                  change({ status: event.target.value as IncidentStatus })
                }
              >
                {[current.status, ...current.allowedStatuses].map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge status={current.status} />
            )}
          </DetailRow>

          <DetailRow label="Priority">
            {canEditFields ? (
              <select
                aria-label="Priority"
                value={current.priority}
                disabled={busy}
                onChange={(event) =>
                  change({ priority: event.target.value as IncidentPriority })
                }
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priorityLabels[priority]}
                  </option>
                ))}
              </select>
            ) : (
              priorityLabels[current.priority]
            )}
          </DetailRow>

          <DetailRow label="Assignee">
            {canEditFields ? (
              <select
                aria-label="Assignee"
                value={current.assignee?.memberId ?? ''}
                disabled={busy}
                onChange={(event) =>
                  change({ assigneeId: event.target.value || null })
                }
              >
                <option value="">Unassigned</option>
                {withCurrent(
                  options.members.map((member) => ({
                    id: member.id,
                    name: personName(member),
                  })),
                  current.assignee && {
                    id: current.assignee.memberId,
                    name: personName(current.assignee),
                  },
                ).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : current.assignee ? (
              personName(current.assignee)
            ) : (
              'Unassigned'
            )}
          </DetailRow>

          <DetailRow label="Team">
            {canEditFields ? (
              <select
                aria-label="Team"
                value={current.assignedTeam?.id ?? ''}
                disabled={busy}
                onChange={(event) =>
                  change({ assignedTeamId: event.target.value || null })
                }
              >
                <option value="">No team</option>
                {withCurrent(options.teams, current.assignedTeam).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            ) : (
              (current.assignedTeam?.name ?? 'No team')
            )}
          </DetailRow>

          <DetailRow label="Project">
            {canEditFields ? (
              <select
                aria-label="Project"
                value={current.project?.id ?? ''}
                disabled={busy}
                onChange={(event) => change({ projectId: event.target.value || null })}
              >
                <option value="">No project</option>
                {withCurrent(options.projects, current.project).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            ) : (
              (current.project?.name ?? 'No project')
            )}
          </DetailRow>

          <DetailRow label="Reported by">
            {current.reporter ? personName(current.reporter) : 'Unknown'}
          </DetailRow>
          <DetailRow label="Created">{formatDateTime(current.createdAt)}</DetailRow>
          <DetailRow label="Updated">{formatDateTime(current.updatedAt)}</DetailRow>
          {current.resolvedAt && (
            <DetailRow label="Resolved">{formatDateTime(current.resolvedAt)}</DetailRow>
          )}
          {current.closedAt && (
            <DetailRow label="Closed">{formatDateTime(current.closedAt)}</DetailRow>
          )}

          {closed && canWork && (
            <p className="muted">
              Closed incidents are read-only. Reopen it to make changes.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

// Picker options plus the current value, if it is not among them (e.g. an
// archived project), so the select can still show it.
function withCurrent<T extends { id: string; name: string }>(
  list: T[],
  current: { id: string; name: string } | null,
): { id: string; name: string }[] {
  return current && !list.some((item) => item.id === current.id)
    ? [current, ...list]
    : list
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail-row">
      <span className="muted">{label}</span>
      <span>{children}</span>
    </div>
  )
}

function EditIncidentForm({
  incident,
  busy,
  error,
  onCancel,
  onSave,
}: {
  incident: IncidentDetail
  busy: boolean
  error: string | null
  onCancel: () => void
  onSave: (input: { title: string; description: string | null }) => Promise<void>
}) {
  const [title, setTitle] = useState(incident.title)
  const [description, setDescription] = useState(incident.description ?? '')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSave({ title, description: description.trim() ? description : null })
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <h2>Edit {incidentKey(incident.number)}</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <TextField
        label="Title"
        required
        maxLength={200}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <TextAreaField
        label="Description"
        maxLength={10000}
        rows={5}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="form-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function CommentItem({
  comment,
  own,
  onEdit,
  onDelete,
}: {
  comment: IncidentComment
  own: boolean
  onEdit: (content: string) => Promise<boolean>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.content)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (await onEdit(draft)) {
      setEditing(false)
    }
  }

  return (
    <li className="timeline-comment">
      <div className="timeline-comment-header">
        <strong>{personName(comment.author)}</strong>
        <time className="muted" dateTime={comment.createdAt}>
          {formatDateTime(comment.createdAt)}
          {comment.edited && ' (edited)'}
        </time>
      </div>

      {editing ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <TextAreaField
            label="Edit comment"
            required
            maxLength={5000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="form-actions">
            <button type="submit">Save</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setDraft(comment.content)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="project-body">{comment.content}</p>
      )}

      {own && !editing && (
        <div className="form-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setDraft(comment.content)
              setEditing(true)
            }}
          >
            Edit
          </button>
          <button type="button" className="link-button danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </li>
  )
}

function CommentForm({
  busy,
  onSubmit,
}: {
  busy: boolean
  onSubmit: (content: string) => Promise<boolean>
}) {
  const [content, setContent] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (await onSubmit(content)) {
      setContent('')
    }
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <TextAreaField
        label="Add a comment"
        required
        maxLength={5000}
        placeholder="Share an update or findings"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="form-actions">
        <button type="submit" disabled={busy}>
          Comment
        </button>
      </div>
    </form>
  )
}
