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
