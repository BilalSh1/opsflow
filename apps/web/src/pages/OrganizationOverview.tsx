import { Link } from 'react-router'
import { getDashboard } from '../api/incidents'
import { PriorityBadge, StatusBadge } from '../components/IncidentBadges'
import { LoadError } from '../components/LoadError'
import { incidentKey, STATUSES, statusLabels } from '../features/incidents/labels'
import { roleLabels } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useResource } from '../hooks/useResource'
import type { IncidentSummary } from '../types/incident'

// The organization's dashboard: incident counts and recent activity.
export function OrganizationOverview() {
  const { organization } = useCurrentOrganization()
  const dashboard = useResource(organization.id, () => getDashboard(organization.id))
  const data = dashboard.state.status === 'ready' ? dashboard.state.data : null

  return (
    <div className="dashboard">
      {dashboard.state.status === 'loading' && (
        <p className="status">Loading dashboard…</p>
      )}

      {dashboard.state.status === 'error' && (
        <LoadError message="Could not load the dashboard." onRetry={dashboard.reload} />
      )}

      {data && (
        <>
          <div className="stat-grid">
            <Link to="incidents" className="stat">
              <span className="stat-value">{data.counts.active}</span>
              <span className="stat-label">Active incidents</span>
            </Link>
            <Link to="incidents?priority=CRITICAL" className="stat stat-critical">
              <span className="stat-value">{data.counts.critical}</span>
              <span className="stat-label">Active critical</span>
            </Link>
          </div>

          <ul className="status-counts" aria-label="Incidents by status">
            {STATUSES.map((status) => (
              <li key={status}>
                <Link to={`incidents?status=${status}`}>
                  {statusLabels[status]}{' '}
                  <strong>{data.counts.byStatus[status]}</strong>
                </Link>
              </li>
            ))}
          </ul>

          <div className="recent-grid">
            <RecentList
              title="Recently created"
              incidents={data.recentlyCreated}
            />
            <RecentList
              title="Recently updated"
              incidents={data.recentlyUpdated}
            />
          </div>
        </>
      )}

      <dl className="details">
        <dt>Slug</dt>
        <dd>{organization.slug}</dd>

        <dt>Your role</dt>
        <dd>{roleLabels[organization.role]}</dd>

        <dt>Created</dt>
        <dd>
          {new Date(organization.createdAt).toLocaleDateString(undefined, {
            dateStyle: 'medium',
          })}
        </dd>
      </dl>
    </div>
  )
}

function RecentList({
  title,
  incidents,
}: {
  title: string
  incidents: IncidentSummary[]
}) {
  return (
    <section className="recent">
      <h3>{title}</h3>
      {incidents.length === 0 ? (
        <p className="muted">No incidents yet.</p>
      ) : (
        <ul>
          {incidents.map((incident) => (
            <li key={incident.id}>
              <Link to={`incidents/${incident.number}`}>
                <span className="incident-key">{incidentKey(incident.number)}</span>{' '}
                {incident.title}
              </Link>
              <span className="form-actions">
                <StatusBadge status={incident.status} />
                <PriorityBadge priority={incident.priority} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
