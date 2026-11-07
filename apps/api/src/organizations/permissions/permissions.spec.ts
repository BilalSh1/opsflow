import { OrganizationRole } from '../../generated/prisma/client';
import { hasPermission } from './permissions';

const { OWNER, ADMIN, MEMBER, VIEWER } = OrganizationRole;

describe('hasPermission', () => {
  describe.each(['members', 'teams', 'projects'] as const)('%s', (area) => {
    it.each([
      [OWNER, true],
      [ADMIN, true],
      [MEMBER, false],
      [VIEWER, false],
    ])(`%s may manage ${area}: %s`, (role, expected) => {
      expect(hasPermission(role, `${area}:manage`)).toBe(expected);
    });

    it.each([OWNER, ADMIN, MEMBER, VIEWER])(`%s may view ${area}`, (role) => {
      expect(hasPermission(role, `${area}:view`)).toBe(true);
    });
  });
});
