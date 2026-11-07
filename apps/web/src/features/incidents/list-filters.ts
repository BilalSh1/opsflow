import type { IncidentPriority, IncidentStatus } from '../../types/incident'
import { ACTIVE_STATUSES, PRIORITIES, STATUSES } from './labels'

// Incident list filters as kept in the page URL. Absent values mean the
// default, so the plain /incidents URL shows active incidents, most
// recently updated first.
export interface IncidentFilters {
  status: 'active' | 'all' | IncidentStatus
  priority: '' | IncidentPriority
  project: string // '' (any), 'none' or a project id
  team: string // '' (any), 'none' or a team id
  assignee: string // '' (anyone), 'me', 'none' or a member id
  q: string
  sort: IncidentSort
  page: number
}

export const SORTS = {
  updated: { label: 'Recently updated', field: 'updatedAt', order: 'desc' },
  created: { label: 'Newest', field: 'createdAt', order: 'desc' },
  priority: { label: 'Priority', field: 'priority', order: 'desc' },
  number: { label: 'Number', field: 'number', order: 'asc' },
} as const

export type IncidentSort = keyof typeof SORTS

export const PAGE_SIZE = 20

export function readFilters(params: URLSearchParams): IncidentFilters {
  const status = params.get('status')
  const priority = params.get('priority')
  const sort = params.get('sort')
  const page = Number(params.get('page'))

  return {
    status:
      status === 'all' || STATUSES.includes(status as IncidentStatus)
        ? (status as IncidentFilters['status'])
        : 'active',
    priority: PRIORITIES.includes(priority as IncidentPriority)
      ? (priority as IncidentPriority)
      : '',
    project: params.get('project') ?? '',
    team: params.get('team') ?? '',
    assignee: params.get('assignee') ?? '',
    q: params.get('q') ?? '',
    sort: sort && sort in SORTS ? (sort as IncidentSort) : 'updated',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

// Only non-default values go into the URL.
export function writeFilters(filters: IncidentFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.status !== 'active') params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.project) params.set('project', filters.project)
  if (filters.team) params.set('team', filters.team)
  if (filters.assignee) params.set('assignee', filters.assignee)
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.sort !== 'updated') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))

  return params
}

// The API's query for these filters.
export function toApiQuery(filters: IncidentFilters): URLSearchParams {
  const query = new URLSearchParams()
  const sort = SORTS[filters.sort]

  if (filters.status === 'active') {
    query.set('status', ACTIVE_STATUSES.join(','))
  } else if (filters.status !== 'all') {
    query.set('status', filters.status)
  }

  if (filters.priority) query.set('priority', filters.priority)
  if (filters.project) query.set('projectId', filters.project)
  if (filters.team) query.set('assignedTeamId', filters.team)
  if (filters.assignee) query.set('assigneeId', filters.assignee)
  if (filters.q.trim()) query.set('search', filters.q.trim())

  query.set('sort', sort.field)
  query.set('order', sort.order)
  query.set('page', String(filters.page))
  query.set('pageSize', String(PAGE_SIZE))

  return query
}
