import type { Prisma } from '../generated/prisma/client';
import { allowedTransitions } from './incident-status';
import type {
  IncidentActivityResponse,
  IncidentCommentResponse,
  IncidentDetailResponse,
  IncidentSummaryResponse,
  PersonRef,
} from './interfaces/incident-response.interface';

const personSelect = {
  select: { id: true, firstName: true, lastName: true },
} as const;

export const incidentSummaryInclude = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, userId: true, user: personSelect } },
  assignedTeam: { select: { id: true, name: true } },
} as const;

export const incidentDetailInclude = {
  ...incidentSummaryInclude,
  reporter: personSelect,
} as const;

export const commentInclude = { author: personSelect } as const;
export const activityInclude = { actor: personSelect } as const;

type IncidentSummaryRow = Prisma.IncidentGetPayload<{
  include: typeof incidentSummaryInclude;
}>;
type IncidentDetailRow = Prisma.IncidentGetPayload<{
  include: typeof incidentDetailInclude;
}>;
type CommentRow = Prisma.IncidentCommentGetPayload<{
  include: typeof commentInclude;
}>;
type ActivityRow = Prisma.IncidentActivityGetPayload<{
  include: typeof activityInclude;
}>;

type PersonRow = { id: string; firstName: string; lastName: string };

export const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`;

function toPerson(person: PersonRow | null): PersonRef | null {
  return person
    ? {
        userId: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
      }
    : null;
}

export function toIncidentSummary(
  incident: IncidentSummaryRow,
): IncidentSummaryResponse {
  return {
    id: incident.id,
    number: incident.number,
    title: incident.title,
    status: incident.status,
    priority: incident.priority,
    project: incident.project,
    assignee: incident.assignee
      ? {
          memberId: incident.assignee.id,
          userId: incident.assignee.userId,
          firstName: incident.assignee.user.firstName,
          lastName: incident.assignee.user.lastName,
        }
      : null,
    assignedTeam: incident.assignedTeam,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

export function toIncidentDetail(
  incident: IncidentDetailRow,
): IncidentDetailResponse {
  return {
    ...toIncidentSummary(incident),
    description: incident.description,
    reporter: toPerson(incident.reporter),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    closedAt: incident.closedAt?.toISOString() ?? null,
    allowedStatuses: [...allowedTransitions(incident.status)],
  };
}

export function toCommentResponse(
  comment: CommentRow,
): IncidentCommentResponse {
  return {
    id: comment.id,
    content: comment.content,
    author: toPerson(comment.author),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    edited: comment.updatedAt.getTime() > comment.createdAt.getTime(),
  };
}

export function toActivityResponse(
  activity: ActivityRow,
): IncidentActivityResponse {
  return {
    id: activity.id,
    type: activity.type,
    actor: toPerson(activity.actor),
    oldValue: activity.oldValue,
    newValue: activity.newValue,
    createdAt: activity.createdAt.toISOString(),
  };
}
