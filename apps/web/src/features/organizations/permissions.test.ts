import { describe, expect, it } from 'vitest'
import { canManageMember, canManageMembers, grantableRoles } from './permissions'

describe('member permissions', () => {
  it('lets owners and admins manage members', () => {
    expect(canManageMembers('OWNER')).toBe(true)
    expect(canManageMembers('ADMIN')).toBe(true)
    expect(canManageMembers('MEMBER')).toBe(false)
    expect(canManageMembers('VIEWER')).toBe(false)
  })

  it('only lets owners grant the owner role', () => {
    expect(grantableRoles('OWNER')).toContain('OWNER')
    expect(grantableRoles('ADMIN')).toEqual(['ADMIN', 'MEMBER', 'VIEWER'])
  })

  it('only lets owners manage owners', () => {
    expect(canManageMember('OWNER', 'OWNER')).toBe(true)
    expect(canManageMember('ADMIN', 'OWNER')).toBe(false)
    expect(canManageMember('ADMIN', 'MEMBER')).toBe(true)
    expect(canManageMember('MEMBER', 'VIEWER')).toBe(false)
  })
})
