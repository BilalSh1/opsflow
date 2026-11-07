import {
  ForbiddenException,
  InternalServerErrorException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole } from '../../generated/prisma/client';
import type { OrganizationRequest } from '../interfaces/membership.interface';
import { PermissionGuard } from './permission.guard';
import type { Permission } from './permissions';

describe('PermissionGuard', () => {
  let getAllAndOverrideMock: jest.Mock;
  let guard: PermissionGuard;

  const contextFor = (request: Partial<OrganizationRequest>) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const requestWithRole = (role: OrganizationRole) =>
    ({ membership: { role } }) as unknown as OrganizationRequest;

  const requirePermission = (permission: Permission | undefined) =>
    getAllAndOverrideMock.mockReturnValue(permission);

  beforeEach(() => {
    getAllAndOverrideMock = jest.fn();
    guard = new PermissionGuard({
      getAllAndOverride: getAllAndOverrideMock,
    } as unknown as Reflector);
  });

  it('allows routes without a required permission', () => {
    requirePermission(undefined);

    expect(guard.canActivate(contextFor({}))).toBe(true);
  });

  it('allows a role that has the permission', () => {
    requirePermission('members:manage');

    expect(
      guard.canActivate(contextFor(requestWithRole(OrganizationRole.ADMIN))),
    ).toBe(true);
  });

  it('returns 403 for a role without the permission', () => {
    requirePermission('members:manage');

    expect(() =>
      guard.canActivate(contextFor(requestWithRole(OrganizationRole.VIEWER))),
    ).toThrow(ForbiddenException);
  });

  it('fails loudly when used without the membership guard', () => {
    requirePermission('members:view');

    expect(() => guard.canActivate(contextFor({}))).toThrow(
      InternalServerErrorException,
    );
  });
});
