import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import {
  deleteProject,
  getProject,
  setProjectArchived,
  updateProject,
} from '../api/projects'
import { LoadError } from '../components/LoadError'
import { TextAreaField } from '../components/TextAreaField'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { canManageProjects } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useResource } from '../hooks/useResource'
import type { Project } from '../types/project'

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })

export function ProjectPage() {
  const { projectId = '' } = useParams()
  const { organization } = useCurrentOrganization()
  const navigate = useNavigate()
  const canManage = canManageProjects(organization.role)

  const project = useResource(`${organization.id}:${projectId}`, () =>
    getProject(organization.id, projectId),
  )

  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const backLink = (
    <Link to=".." relative="path" className="back-link">
      ← All projects
    </Link>
  )

  if (project.state.status === 'loading') {
    return <p className="status">Loading project…</p>
  }

  if (project.state.status === 'error') {
    const { error: loadError } = project.state

    if (loadError instanceof ApiError && loadError.status === 404) {
      return (
        <div className="panel">
          {backLink}
          <h2>Project not found</h2>
          <p className="muted">It may have been deleted.</p>
        </div>
      )
    }

    return (
      <LoadError message="Could not load this project." onRetry={project.reload} />
    )
  }

  const current = project.state.data
  const isArchived = current.archivedAt !== null

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

  const replace = (updated: Project) => project.update(() => updated)

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete the project ${current.name}? This cannot be undone.`,
      )
    ) {
      return
    }

    await run(async () => {
      await deleteProject(organization.id, current.id)
      navigate('..', { relative: 'path', replace: true })
    })
  }

  return (
    <div className="project">
      {backLink}

      {editing ? (
        <EditProjectForm
          project={current}
          busy={busy}
          error={error}
          onCancel={() => {
            setError(null)
            setEditing(false)
          }}
          onSave={async (input) => {
            if (
              await run(async () =>
                replace(await updateProject(organization.id, current.id, input)),
              )
            ) {
              setEditing(false)
            }
          }}
        />
      ) : (
        <>
          <div className="team-header">
            <h2>
              {current.name}
              {isArchived && <span className="badge">Archived</span>}
            </h2>

            {canManage && (
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setError(null)
                    setEditing(true)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () =>
                      replace(
                        await setProjectArchived(
                          organization.id,
                          current.id,
                          !isArchived,
                        ),
                      ),
                    )
                  }
                >
                  {isArchived ? 'Restore' : 'Archive'}
                </button>
                <button
                  type="button"
                  className="secondary danger"
                  disabled={busy}
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <p className={current.description ? 'project-body' : 'muted'}>
            {current.description ?? 'No description.'}
          </p>

          <dl className="details">
            <dt>Created</dt>
            <dd>{formatDate(current.createdAt)}</dd>

            <dt>Last updated</dt>
            <dd>{formatDate(current.updatedAt)}</dd>

            {isArchived && (
              <>
                <dt>Archived</dt>
                <dd>{formatDate(current.archivedAt!)}</dd>
              </>
            )}
          </dl>

          <Link
            to={`../../incidents?project=${current.id}&status=all`}
            relative="path"
          >
            View this project’s incidents
          </Link>
        </>
      )}
    </div>
  )
}

function EditProjectForm({
  project,
  busy,
  error,
  onCancel,
  onSave,
}: {
  project: Project
  busy: boolean
  error: string | null
  onCancel: () => void
  onSave: (input: { name: string; description: string | null }) => Promise<void>
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // An emptied description is cleared rather than saved as blank.
    await onSave({ name, description: description.trim() ? description : null })
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <h2>Edit project</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <TextField
        label="Project name"
        required
        maxLength={100}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextAreaField
        label="Description"
        maxLength={2000}
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
