import { priorityLabels, statusLabels } from '../features/incidents/labels'
import type { IncidentPriority, IncidentStatus } from '../types/incident'

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`pill status-${status.toLowerCase()}`}>
      {statusLabels[status]}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  return (
    <span className={`pill priority-${priority.toLowerCase()}`}>
      {priorityLabels[priority]}
    </span>
  )
}
