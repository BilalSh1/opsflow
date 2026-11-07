import { OrganizationRole } from '../../generated/prisma/client';
import { hasPermission } from './permissions';

describe('hasPermission', () => {
  it.each([
    [OrganizationRole.OWNER, true],
    [OrganizationRole.ADMIN, true],
    [OrganizationRole.MEMBER, false],
    [OrganizationRole.VIEWER, false],
  ])('%s may manage members: %s', (role, expected) => {
    expect(hasPermission(role, 'members:manage')).toBe(expected);
  });

  it.each(Object.values(OrganizationRole))('%s may view members', (role) => {
    expect(hasPermission(role, 'members:view')).toBe(true);
  });
});
