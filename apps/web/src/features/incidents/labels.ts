import type {
  IncidentActivity,
  IncidentPriority,
  IncidentStatus,
} from '../../types/incident'

export const STATUSES: IncidentStatus[] = [
  'OPEN',
  'INVESTIGATING',
  'BLOCKED',
  'RESOLVED',
  'CLOSED',
]

export const ACTIVE_STATUSES: IncidentStatus[] = ['OPEN', 'INVESTIGATING', 'BLOCKED']

// Most urgent first, for pickers.
export const PRIORITIES: IncidentPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export const statusLabels: Record<IncidentStatus, string> = {
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  BLOCKED: 'Blocked',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

export const priorityLabels: Record<IncidentPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const incidentKey = (number: number) => `INC-${number}`

export const personName = (
  person: { firstName: string; lastName: string } | null,
) => (person ? `${person.firstName} ${person.lastName}` : 'Someone')

const valueLabel = (value: string | null) =>
  value === null
    ? 'none'
    : (statusLabels[value as IncidentStatus] ??
      priorityLabels[value as IncidentPriority] ??
      value)

// "Ada changed status from Open to Investigating."
export function describeActivity(activity: IncidentActivity): string {
  const who = personName(activity.actor)
  const from = valueLabel(activity.oldValue)
  const to = valueLabel(activity.newValue)

  switch (activity.type) {
    case 'CREATED':
      return `${who} created the incident.`
    case 'TITLE_CHANGED':
      return `${who} renamed the incident from “${from}” to “${to}”.`
    case 'DESCRIPTION_CHANGED':
      return `${who} updated the description.`
    case 'STATUS_CHANGED':
      return `${who} changed status from ${from} to ${to}.`
    case 'PRIORITY_CHANGED':
      return `${who} changed priority from ${from} to ${to}.`
    case 'ASSIGNEE_CHANGED':
      return activity.newValue
        ? `${who} assigned the incident to ${activity.newValue}.`
        : `${who} unassigned ${activity.oldValue ?? 'the incident'}.`
    case 'TEAM_CHANGED':
      return activity.newValue
        ? `${who} assigned the incident to the ${activity.newValue} team.`
        : `${who} removed the ${activity.oldValue ?? ''} team.`
    case 'PROJECT_CHANGED':
      return activity.newValue
        ? `${who} moved the incident to ${activity.newValue}.`
        : `${who} removed it from ${activity.oldValue ?? 'its project'}.`
    case 'COMMENT_ADDED':
      return `${who} added a comment.`
  }
}

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
