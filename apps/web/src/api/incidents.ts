import type {
  Dashboard,
  IncidentActivity,
  IncidentComment,
  IncidentDetail,
  IncidentInput,
  IncidentList,
} from '../types/incident'
import { apiRequest } from './client'

const orgPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`

const incidentPath = (organizationId: string, number: number) =>
  `${orgPath(organizationId)}/incidents/${number}`

// `query` holds the API's list parameters (status, priority, page, ...).
export function listIncidents(
  organizationId: string,
  query: URLSearchParams,
): Promise<IncidentList> {
  const search = query.toString()

  return apiRequest<IncidentList>(
    `${orgPath(organizationId)}/incidents${search ? `?${search}` : ''}`,
  )
}

export async function getIncident(
  organizationId: string,
  number: number,
): Promise<IncidentDetail> {
  const { incident } = await apiRequest<{ incident: IncidentDetail }>(
    incidentPath(organizationId, number),
  )

  return incident
}

export async function createIncident(
  organizationId: string,
  input: IncidentInput & { title: string },
): Promise<IncidentDetail> {
  const { incident } = await apiRequest<{ incident: IncidentDetail }>(
    `${orgPath(organizationId)}/incidents`,
    { method: 'POST', body: input },
  )

  return incident
}

export async function updateIncident(
  organizationId: string,
  number: number,
  input: IncidentInput,
): Promise<IncidentDetail> {
  const { incident } = await apiRequest<{ incident: IncidentDetail }>(
    incidentPath(organizationId, number),
    { method: 'PATCH', body: input },
  )

  return incident
}

export async function listActivity(
  organizationId: string,
  number: number,
): Promise<IncidentActivity[]> {
  const { activity } = await apiRequest<{ activity: IncidentActivity[] }>(
    `${incidentPath(organizationId, number)}/activity`,
  )

  return activity
}

export async function listComments(
  organizationId: string,
  number: number,
): Promise<IncidentComment[]> {
  const { comments } = await apiRequest<{ comments: IncidentComment[] }>(
    `${incidentPath(organizationId, number)}/comments`,
  )

  return comments
}

export async function addComment(
  organizationId: string,
  number: number,
  content: string,
): Promise<IncidentComment> {
  const { comment } = await apiRequest<{ comment: IncidentComment }>(
    `${incidentPath(organizationId, number)}/comments`,
    { method: 'POST', body: { content } },
  )

  return comment
}

export async function editComment(
  organizationId: string,
  number: number,
  commentId: string,
  content: string,
): Promise<IncidentComment> {
  const { comment } = await apiRequest<{ comment: IncidentComment }>(
    `${incidentPath(organizationId, number)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'PATCH', body: { content } },
  )

  return comment
}

export function deleteComment(
  organizationId: string,
  number: number,
  commentId: string,
): Promise<void> {
  return apiRequest<void>(
    `${incidentPath(organizationId, number)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' },
  )
}

export function getDashboard(organizationId: string): Promise<Dashboard> {
  return apiRequest<Dashboard>(`${orgPath(organizationId)}/dashboard`)
}
