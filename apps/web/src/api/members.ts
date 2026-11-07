import type { Member } from '../types/member'
import type { OrganizationRole } from '../types/organization'
import { apiRequest } from './client'

const membersPath = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/members`

export async function listMembers(organizationId: string): Promise<Member[]> {
  const { members } = await apiRequest<{ members: Member[] }>(
    membersPath(organizationId),
  )

  return members
}

export async function addMember(
  organizationId: string,
  email: string,
  role: OrganizationRole,
): Promise<Member> {
  const { member } = await apiRequest<{ member: Member }>(
    membersPath(organizationId),
    { method: 'POST', body: { email, role } },
  )

  return member
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: OrganizationRole,
): Promise<Member> {
  const { member } = await apiRequest<{ member: Member }>(
    `${membersPath(organizationId)}/${encodeURIComponent(memberId)}`,
    { method: 'PATCH', body: { role } },
  )

  return member
}

export function removeMember(
  organizationId: string,
  memberId: string,
): Promise<void> {
  return apiRequest<void>(
    `${membersPath(organizationId)}/${encodeURIComponent(memberId)}`,
    { method: 'DELETE' },
  )
}
