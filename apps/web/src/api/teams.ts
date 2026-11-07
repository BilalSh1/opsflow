import type { TeamDetail, TeamMember, TeamSummary } from '../types/team'
import { apiRequest } from './client'

const teamsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/teams`

const teamPath = (organizationId: string, teamId: string) =>
  `${teamsPath(organizationId)}/${encodeURIComponent(teamId)}`

export async function listTeams(organizationId: string): Promise<TeamSummary[]> {
  const { teams } = await apiRequest<{ teams: TeamSummary[] }>(
    teamsPath(organizationId),
  )

  return teams
}

export async function createTeam(
  organizationId: string,
  name: string,
): Promise<TeamSummary> {
  const { team } = await apiRequest<{ team: TeamSummary }>(
    teamsPath(organizationId),
    { method: 'POST', body: { name } },
  )

  return team
}

export async function getTeam(
  organizationId: string,
  teamId: string,
): Promise<TeamDetail> {
  const { team } = await apiRequest<{ team: TeamDetail }>(
    teamPath(organizationId, teamId),
  )

  return team
}

export async function renameTeam(
  organizationId: string,
  teamId: string,
  name: string,
): Promise<TeamSummary> {
  const { team } = await apiRequest<{ team: TeamSummary }>(
    teamPath(organizationId, teamId),
    { method: 'PATCH', body: { name } },
  )

  return team
}

export function deleteTeam(organizationId: string, teamId: string): Promise<void> {
  return apiRequest<void>(teamPath(organizationId, teamId), {
    method: 'DELETE',
  })
}

export async function addTeamMember(
  organizationId: string,
  teamId: string,
  memberId: string,
): Promise<TeamMember> {
  const { member } = await apiRequest<{ member: TeamMember }>(
    `${teamPath(organizationId, teamId)}/members`,
    { method: 'POST', body: { memberId } },
  )

  return member
}

export function removeTeamMember(
  organizationId: string,
  teamId: string,
  memberId: string,
): Promise<void> {
  return apiRequest<void>(
    `${teamPath(organizationId, teamId)}/members/${encodeURIComponent(memberId)}`,
    { method: 'DELETE' },
  )
}
