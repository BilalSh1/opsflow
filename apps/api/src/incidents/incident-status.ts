import { IncidentStatus } from '../generated/prisma/client';

const { OPEN, INVESTIGATING, BLOCKED, RESOLVED, CLOSED } = IncidentStatus;

// Allowed next statuses. Resolved and closed incidents can be reopened.
const TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  [OPEN]: [INVESTIGATING, BLOCKED, RESOLVED],
  [INVESTIGATING]: [OPEN, BLOCKED, RESOLVED],
  [BLOCKED]: [OPEN, INVESTIGATING, RESOLVED],
  [RESOLVED]: [INVESTIGATING, CLOSED],
  [CLOSED]: [OPEN],
};

// Not resolved or closed yet.
export const ACTIVE_STATUSES: readonly IncidentStatus[] = [
  OPEN,
  INVESTIGATING,
  BLOCKED,
];

export function allowedTransitions(
  from: IncidentStatus,
): readonly IncidentStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

// resolvedAt and closedAt after moving to `to`: set when the incident
// first reaches the state, cleared when it moves back before it.
export function lifecycleDates(
  to: IncidentStatus,
  current: { resolvedAt: Date | null; closedAt: Date | null },
  now: Date,
): { resolvedAt: Date | null; closedAt: Date | null } {
  switch (to) {
    case RESOLVED:
      return { resolvedAt: current.resolvedAt ?? now, closedAt: null };
    case CLOSED:
      return {
        resolvedAt: current.resolvedAt ?? now,
        closedAt: current.closedAt ?? now,
      };
    default:
      return { resolvedAt: null, closedAt: null };
  }
}
