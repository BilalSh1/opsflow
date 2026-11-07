export type IncidentStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'BLOCKED'
  | 'RESOLVED'
  | 'CLOSED'

export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type IncidentActivityType =
  | 'CREATED'
  | 'TITLE_CHANGED'
  | 'DESCRIPTION_CHANGED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'TEAM_CHANGED'
  | 'PROJECT_CHANGED'
  | 'COMMENT_ADDED'

export interface PersonRef {
  userId: string
  firstName: string
  lastName: string
}

// `memberId` is the organization membership id, as in the members list.
export interface AssigneeRef extends PersonRef {
  memberId: string
}

export interface NamedRef {
  id: string
  name: string
}

export interface IncidentSummary {
  id: string
  number: number
  title: string
  status: IncidentStatus
  priority: IncidentPriority
  project: NamedRef | null
  assignee: AssigneeRef | null
  assignedTeam: NamedRef | null
  createdAt: string
  updatedAt: string
}

export interface IncidentDetail extends IncidentSummary {
  description: string | null
  reporter: PersonRef | null
  resolvedAt: string | null
  closedAt: string | null
  allowedStatuses: IncidentStatus[]
}

export interface IncidentList {
  incidents: IncidentSummary[]
  page: number
  pageSize: number
  total: number
}

export interface IncidentComment {
  id: string
  content: string
  author: PersonRef | null
  createdAt: string
  updatedAt: string
  edited: boolean
}

export interface IncidentActivity {
  id: string
  type: IncidentActivityType
  actor: PersonRef | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export interface Dashboard {
  counts: {
    byStatus: Record<IncidentStatus, number>
    active: number
    critical: number
  }
  recentlyCreated: IncidentSummary[]
  recentlyUpdated: IncidentSummary[]
}

// Fields accepted when creating or updating. For updates, `null` clears a
// value and leaving a field out keeps it.
export interface IncidentInput {
  title?: string
  description?: string | null
  status?: IncidentStatus
  priority?: IncidentPriority
  projectId?: string | null
  assigneeId?: string | null
  assignedTeamId?: string | null
}
