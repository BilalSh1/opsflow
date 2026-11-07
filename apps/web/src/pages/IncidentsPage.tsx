import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { listIncidents } from '../api/incidents'
import { PriorityBadge, StatusBadge } from '../components/IncidentBadges'
import { LoadError } from '../components/LoadError'
import {
  incidentKey,
  personName,
  PRIORITIES,
  priorityLabels,
  STATUSES,
  statusLabels,
} from '../features/incidents/labels'
import {
  readFilters,
  SORTS,
  toApiQuery,
  writeFilters,
  type IncidentFilters,
  type IncidentSort,
} from '../features/incidents/list-filters'
import { useIncidentOptions } from '../features/incidents/useIncidentOptions'
import { canWorkOnIncidents } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'
import { useResource } from '../hooks/useResource'

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })

export function IncidentsPage() {
  const { organization } = useCurrentOrganization()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const apiQuery = toApiQuery(filters)
  const options = useIncidentOptions(organization.id)

  const incidents = useResource(`${organization.id}?${apiQuery}`, () =>
    listIncidents(organization.id, apiQuery),
  )

  // Changing a filter starts again from the first page.
  const setFilter = (changes: Partial<IncidentFilters>) =>
    setSearchParams(writeFilters({ ...filters, page: 1, ...changes }))

  return (
    <div className="incidents">
      <div className="incidents-toolbar">
        <SearchForm
          key={filters.q}
          initial={filters.q}
          onSearch={(q) => setFilter({ q })}
        />
        {canWorkOnIncidents(organization.role) && (
          <Link to="new" className="button-link">
            New incident
          </Link>
        )}
      </div>

      <div className="filters">
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(status) =>
            setFilter({ status: status as IncidentFilters['status'] })
          }
          options={[
            ['active', 'Active (open, investigating, blocked)'],
            ['all', 'All statuses'],
            ...STATUSES.map((status) => [status, statusLabels[status]] as const),
          ]}
        />
        <FilterSelect
          label="Priority"
          value={filters.priority}
          onChange={(priority) =>
            setFilter({ priority: priority as IncidentFilters['priority'] })
          }
          options={[
            ['', 'Any priority'],
            ...PRIORITIES.map(
              (priority) => [priority, priorityLabels[priority]] as const,
            ),
          ]}
        />
        <FilterSelect
          label="Assignee"
          value={filters.assignee}
          onChange={(assignee) => setFilter({ assignee })}
          options={[
            ['', 'Anyone'],
            ['me', 'Assigned to me'],
            ['none', 'Unassigned'],
            ...options.members.map(
              (member) => [member.id, personName(member)] as const,
            ),
          ]}
        />
        <FilterSelect
          label="Team"
          value={filters.team}
          onChange={(team) => setFilter({ team })}
          options={[
            ['', 'Any team'],
            ['none', 'No team'],
            ...options.teams.map((team) => [team.id, team.name] as const),
          ]}
        />
        <FilterSelect
          label="Project"
          value={filters.project}
          onChange={(project) => setFilter({ project })}
          options={[
            ['', 'Any project'],
            ['none', 'No project'],
            ...options.projects.map(
              (project) => [project.id, project.name] as const,
            ),
          ]}
        />
        <FilterSelect
          label="Sort by"
          value={filters.sort}
          onChange={(sort) => setFilter({ sort: sort as IncidentSort })}
          options={Object.entries(SORTS).map(
            ([key, sort]) => [key, sort.label] as const,
          )}
        />
      </div>

      {incidents.state.status === 'loading' && (
        <p className="status">Loading incidents…</p>
      )}

      {incidents.state.status === 'error' && (
        <LoadError
          message="Could not load the incidents."
          onRetry={incidents.reload}
        />
      )}

      {incidents.state.status === 'ready' &&
        (incidents.state.data.total === 0 ? (
          <p className="muted">No incidents match these filters.</p>
        ) : (
          <>
            <ul className="incident-list">
              {incidents.state.data.incidents.map((incident) => (
                <li key={incident.id}>
                  <div className="incident-list-title">
                    <span className="incident-key">
                      {incidentKey(incident.number)}
                    </span>
                    <Link to={String(incident.number)}>{incident.title}</Link>
                  </div>
                  <div className="incident-list-meta">
                    <StatusBadge status={incident.status} />
                    <PriorityBadge priority={incident.priority} />
                    <span className="muted">
                      {incident.assignee
                        ? personName(incident.assignee)
                        : 'Unassigned'}
                      {incident.assignedTeam && ` · ${incident.assignedTeam.name}`}
                      {incident.project && ` · ${incident.project.name}`}
                    </span>
                    <span className="muted incident-updated">
                      Updated {formatDate(incident.updatedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={incidents.state.data.page}
              pageSize={incidents.state.data.pageSize}
              total={incidents.state.data.total}
              onPage={(page) => setSearchParams(writeFilters({ ...filters, page }))}
            />
          </>
        ))}
    </div>
  )
}

function SearchForm({
  initial,
  onSearch,
}: {
  initial: string
  onSearch: (q: string) => void
}) {
  const [q, setQ] = useState(initial)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(q)
  }

  return (
    <form className="search-form" role="search" onSubmit={handleSubmit}>
      <label htmlFor="incident-search" className="visually-hidden">
        Search incidents
      </label>
      <input
        id="incident-search"
        type="search"
        placeholder="Search by title or INC-number"
        maxLength={200}
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      <button type="submit" className="secondary">
        Search
      </button>
    </form>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
}) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav className="pagination" aria-label="Incident pages">
      <span className="muted">
        {first}–{last} of {total}
      </span>
      <div className="form-actions">
        <button
          type="button"
          className="secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          type="button"
          className="secondary"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
