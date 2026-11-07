import type { OrganizationRole } from './organization'

export interface Member {
  id: string
  userId: string
  email: string
  firstName: string
  lastName: string
  role: OrganizationRole
  joinedAt: string
}
