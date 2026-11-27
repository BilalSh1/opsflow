import type { Organization } from '../types/organization'
import { apiRequest } from './client'

export async function listOrganizations(): Promise<Organization[]> {
  const { organizations } = await apiRequest<{
    organizations: Organization[]
  }>('/organizations')

  return organizations
}

export async function getOrganization(
  organizationId: string,
): Promise<Organization> {
  const { organization } = await apiRequest<{ organization: Organization }>(
    `/organizations/${encodeURIComponent(organizationId)}`,
  )

  return organization
}

export async function createOrganization(name: string): Promise<Organization> {
  const { organization } = await apiRequest<{ organization: Organization }>(
    '/organizations',
    { method: 'POST', body: { name } },
  )

  return organization
}

export async function renameOrganization(
  organizationId: string,
  name: string,
): Promise<Organization> {
  const { organization } = await apiRequest<{ organization: Organization }>(
    `/organizations/${encodeURIComponent(organizationId)}`,
    { method: 'PATCH', body: { name } },
  )

  return organization
}

export function deleteOrganization(organizationId: string): Promise<void> {
  return apiRequest<void>(
    `/organizations/${encodeURIComponent(organizationId)}`,
    { method: 'DELETE' },
  )
}
