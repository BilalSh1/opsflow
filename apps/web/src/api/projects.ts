import type { Project } from '../types/project'
import { apiRequest } from './client'

const projectsPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/projects`

const projectPath = (organizationId: string, projectId: string) =>
  `${projectsPath(organizationId)}/${encodeURIComponent(projectId)}`

export async function listProjects(
  organizationId: string,
  archived = false,
): Promise<Project[]> {
  const { projects } = await apiRequest<{ projects: Project[] }>(
    `${projectsPath(organizationId)}${archived ? '?archived=true' : ''}`,
  )

  return projects
}

export async function createProject(
  organizationId: string,
  input: { name: string; description?: string },
): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>(
    projectsPath(organizationId),
    { method: 'POST', body: input },
  )

  return project
}

export async function getProject(
  organizationId: string,
  projectId: string,
): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>(
    projectPath(organizationId, projectId),
  )

  return project
}

// `description: null` clears it.
export async function updateProject(
  organizationId: string,
  projectId: string,
  input: { name?: string; description?: string | null },
): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>(
    projectPath(organizationId, projectId),
    { method: 'PATCH', body: input },
  )

  return project
}

export async function setProjectArchived(
  organizationId: string,
  projectId: string,
  archived: boolean,
): Promise<Project> {
  const { project } = await apiRequest<{ project: Project }>(
    `${projectPath(organizationId, projectId)}/${archived ? 'archive' : 'unarchive'}`,
    { method: 'POST' },
  )

  return project
}

export function deleteProject(
  organizationId: string,
  projectId: string,
): Promise<void> {
  return apiRequest<void>(projectPath(organizationId, projectId), {
    method: 'DELETE',
  })
}
