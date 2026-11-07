import { listMembers } from '../../api/members'
import { listProjects } from '../../api/projects'
import { listTeams } from '../../api/teams'
import { useResource, type ResourceState } from '../../hooks/useResource'
import type { Member } from '../../types/member'
import type { Project } from '../../types/project'
import type { TeamSummary } from '../../types/team'

export interface IncidentOptions {
  members: Member[]
  // Active projects only: archived ones cannot receive incidents.
  projects: Project[]
  teams: TeamSummary[]
}

const readyOrEmpty = <T>(state: ResourceState<T[]>): T[] =>
  state.status === 'ready' ? state.data : []

// The organization's members, active projects and teams, for incident
// pickers and filters. Lists stay empty until loaded (or if loading fails),
// so pickers simply show fewer choices.
export function useIncidentOptions(organizationId: string): IncidentOptions {
  const members = useResource(`${organizationId}:members`, () =>
    listMembers(organizationId),
  )
  const projects = useResource(`${organizationId}:projects`, () =>
    listProjects(organizationId),
  )
  const teams = useResource(`${organizationId}:teams`, () =>
    listTeams(organizationId),
  )

  return {
    members: readyOrEmpty(members.state),
    projects: readyOrEmpty(projects.state),
    teams: readyOrEmpty(teams.state),
  }
}
