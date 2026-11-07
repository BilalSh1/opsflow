import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { createIncident } from '../api/incidents'
import { TextAreaField } from '../components/TextAreaField'
import { TextField } from '../components/TextField'
import { errorMessage } from '../features/auth/error-message'
import { personName, PRIORITIES, priorityLabels } from '../features/incidents/labels'
import { useIncidentOptions } from '../features/incidents/useIncidentOptions'
import { canWorkOnIncidents } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import type { IncidentPriority } from '../types/incident'

export function NewIncidentPage() {
  const { organization } = useCurrentOrganization()
  const options = useIncidentOptions(organization.id)
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<IncidentPriority>('MEDIUM')
  const [projectId, setProjectId] = useState('')
  const [assignedTeamId, setAssignedTeamId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Viewers cannot report incidents; the API would refuse anyway.
  if (!canWorkOnIncidents(organization.role)) {
    return <Navigate to=".." relative="path" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const incident = await createIncident(organization.id, {
        title,
        priority,
        ...(description.trim() ? { description } : {}),
        ...(projectId ? { projectId } : {}),
        ...(assignedTeamId ? { assignedTeamId } : {}),
        ...(assigneeId ? { assigneeId } : {}),
      })

      navigate(`../${incident.number}`, { relative: 'path', replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
      setSubmitting(false)
    }
  }

  return (
    <form className="inline-form incident-form" onSubmit={handleSubmit}>
      <Link to=".." relative="path" className="back-link">
        ← All incidents
      </Link>
      <h2>Report an incident</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <TextField
        label="Title"
        required
        maxLength={200}
        placeholder="Payment API returning 500 errors"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <TextAreaField
        label="Description (optional)"
        maxLength={10000}
        rows={5}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="field-grid">
        <div className="field">
          <label htmlFor="new-incident-priority">Priority</label>
          <select
            id="new-incident-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as IncidentPriority)}
          >
            {PRIORITIES.map((option) => (
              <option key={option} value={option}>
                {priorityLabels[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="new-incident-project">Project</label>
          <select
            id="new-incident-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {options.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="new-incident-team">Team</label>
          <select
            id="new-incident-team"
            value={assignedTeamId}
            onChange={(event) => setAssignedTeamId(event.target.value)}
          >
            <option value="">No team</option>
            {options.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="new-incident-assignee">Assignee</label>
          <select
            id="new-incident-assignee"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {options.members.map((member) => (
              <option key={member.id} value={member.id}>
                {personName(member)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Reporting…' : 'Report incident'}
        </button>
        <Link to=".." relative="path">
          Cancel
        </Link>
      </div>
    </form>
  )
}
