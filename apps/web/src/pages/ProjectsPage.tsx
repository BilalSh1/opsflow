import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { createProject, listProjects } from '../api/projects'
import { LoadError } from '../components/LoadError'
import { TextAreaField } from '../components/TextAreaField'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { canManageProjects } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useResource } from '../hooks/useResource'
import type { Project } from '../types/project'

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name)

export function ProjectsPage() {
  const { organization } = useCurrentOrganization()
  const [searchParams, setSearchParams] = useSearchParams()
  const archived = searchParams.get('view') === 'archived'
  const canManage = canManageProjects(organization.role)

  const projects = useResource(`${organization.id}:${archived}`, () =>
    listProjects(organization.id, archived),
  )

  return (
    <div className="projects">
      <div className="segmented" role="group" aria-label="Show projects">
        <button
          type="button"
          aria-pressed={!archived}
          onClick={() => setSearchParams({})}
        >
          Active
        </button>
        <button
          type="button"
          aria-pressed={archived}
          onClick={() => setSearchParams({ view: 'archived' })}
        >
          Archived
        </button>
      </div>

      {canManage && !archived && (
        <CreateProjectForm
          onCreate={async (input) => {
            const project = await createProject(organization.id, input)
            projects.update((current) => [...current, project].sort(byName))
          }}
        />
      )}

      {projects.state.status === 'loading' && (
        <p className="status">Loading projects…</p>
      )}

      {projects.state.status === 'error' && (
        <LoadError
          message="Could not load the projects."
          onRetry={projects.reload}
        />
      )}

      {projects.state.status === 'ready' &&
        (projects.state.data.length === 0 ? (
          <p className="muted">
            {archived ? 'No archived projects.' : 'No projects yet.'}
          </p>
        ) : (
          <ul className="project-list">
            {projects.state.data.map((project) => (
              <li key={project.id}>
                <Link to={project.id}>{project.name}</Link>
                {project.description && (
                  <span className="muted project-description">
                    {project.description}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

function CreateProjectForm({
  onCreate,
}: {
  onCreate: (input: { name: string; description?: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await onCreate({
        name,
        ...(description.trim() ? { description } : {}),
      })
      setName('')
      setDescription('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <h2>Create a project</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <TextField
        label="Project name"
        required
        maxLength={100}
        placeholder="Payments Platform"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextAreaField
        label="Description (optional)"
        maxLength={2000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </form>
  )
}
