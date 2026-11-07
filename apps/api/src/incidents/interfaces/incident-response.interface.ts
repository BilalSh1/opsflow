import type {
  IncidentActivityType,
  IncidentPriority,
  IncidentStatus,
} from '../../generated/prisma/client';

// A user shown by name: reporter, comment author, activity actor.
export interface PersonRef {
  userId: string;
  firstName: string;
  lastName: string;
}

// `memberId` is the organization membership id, as in the members list.
export interface AssigneeRef extends PersonRef {
  memberId: string;
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface IncidentSummaryResponse {
  id: string;
  number: number;
  title: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  project: NamedRef | null;
  assignee: AssigneeRef | null;
  assignedTeam: NamedRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentDetailResponse extends IncidentSummaryResponse {
  description: string | null;
  reporter: PersonRef | null;
  resolvedAt: string | null;
  closedAt: string | null;
  // Statuses this incident can move to next.
  allowedStatuses: IncidentStatus[];
}

export interface IncidentListResponse {
  incidents: IncidentSummaryResponse[];
  page: number;
  pageSize: number;
  total: number;
}

export interface IncidentCommentResponse {
  id: string;
  content: string;
  author: PersonRef | null;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
}

export interface IncidentActivityResponse {
  id: string;
  type: IncidentActivityType;
  actor: PersonRef | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface DashboardResponse {
  counts: {
    byStatus: Record<IncidentStatus, number>;
    // Open, investigating or blocked.
    active: number;
    // Active and CRITICAL.
    critical: number;
  };
  recentlyCreated: IncidentSummaryResponse[];
  recentlyUpdated: IncidentSummaryResponse[];
}
