import type { OrganizationRole } from './organization'

export interface TeamSummary {
  id: string
  name: string
  memberCount: number
  createdAt: string
}

// `memberId` is the organization membership id, as in the members list.
export interface TeamMember {
  memberId: string
  userId: string
  email: string
  firstName: string
  lastName: string
  role: OrganizationRole
  addedAt: string
}

export interface TeamDetail {
  id: string
  name: string
  createdAt: string
  members: TeamMember[]
}
