import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationRole,
  type OrganizationMember,
  type Prisma,
} from '../generated/prisma/client';
import { UsersService } from '../users/users.service';
import type { MemberWithUser } from './interfaces/membership.interface';
import type { MemberResponse } from './interfaces/member-response.interface';
import { OrganizationMembersService } from './organization-members.service';
import { hasPermission } from './permissions/permissions';

// The acting user's membership in the organization (from the guard).
type Actor = Pick<OrganizationMember, 'organizationId' | 'userId' | 'role'>;

@Injectable()
export class MembersService {
  constructor(
    private readonly organizationMembersService: OrganizationMembersService,
    private readonly usersService: UsersService,
  ) {}

  async list(organizationId: string): Promise<MemberResponse[]> {
    const members =
      await this.organizationMembersService.findAllInOrganization(
        organizationId,
      );

    return members.map((member) => this.toResponse(member));
  }

  // Adds an existing user directly; there is no invitation step.
  async add(
    actor: Actor,
    email: string,
    role: OrganizationRole,
  ): Promise<MemberResponse> {
    this.assertMayGrant(actor, role);

    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('No account found with this email');
    }

    try {
      const member = await this.organizationMembersService.create(
        actor.organizationId,
        user.id,
        role,
      );

      return this.toResponse(member);
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('This user is already a member');
      }

      throw error;
    }
  }

  async updateRole(
    actor: Actor,
    memberId: string,
    role: OrganizationRole,
  ): Promise<MemberResponse> {
    this.assertMayGrant(actor, role);

    return this.organizationMembersService.withOrganizationLock(
      actor.organizationId,
      async (tx) => {
        const current = await this.currentActor(tx, actor);

        this.assertMayManageMembers(current);
        this.assertMayGrant(current, role);

        const target = await this.findTarget(tx, current, memberId);

        this.assertMayManage(current, target);

        if (
          target.role === OrganizationRole.OWNER &&
          role !== OrganizationRole.OWNER
        ) {
          await this.assertNotLastOwner(tx, actor.organizationId);
        }

        const updated = await this.organizationMembersService.updateRole(
          tx,
          target.id,
          role,
        );

        return this.toResponse(updated);
      },
    );
  }

  // Owners and admins can remove others; anyone can remove themselves.
  async remove(actor: Actor, memberId: string): Promise<void> {
    return this.organizationMembersService.withOrganizationLock(
      actor.organizationId,
      async (tx) => {
        const current = await this.currentActor(tx, actor);
        const target = await this.findTarget(tx, current, memberId);
        const isSelf = target.userId === current.userId;

        if (!isSelf) {
          this.assertMayManageMembers(current);
          this.assertMayManage(current, target);
        }

        if (target.role === OrganizationRole.OWNER) {
          await this.assertNotLastOwner(tx, actor.organizationId);
        }

        await this.organizationMembersService.delete(tx, target.id);
      },
    );
  }

  // The guard loaded the actor before the lock was taken; re-read it so a
  // role change that just committed is respected.
  private async currentActor(
    tx: Prisma.TransactionClient,
    actor: Actor,
  ): Promise<OrganizationMember> {
    const current = await this.organizationMembersService.findByUser(
      tx,
      actor.organizationId,
      actor.userId,
    );

    if (!current) {
      throw new NotFoundException('Organization not found');
    }

    return current;
  }

  private assertMayManageMembers(actor: Actor): void {
    if (!hasPermission(actor.role, 'members:manage')) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
  }

  private async findTarget(
    tx: Prisma.TransactionClient,
    actor: Actor,
    memberId: string,
  ): Promise<OrganizationMember> {
    const target = await this.organizationMembersService.findInOrganization(
      tx,
      actor.organizationId,
      memberId,
    );

    if (!target) {
      throw new NotFoundException('Member not found');
    }

    return target;
  }

  // Only owners may give out the OWNER role.
  private assertMayGrant(actor: Actor, role: OrganizationRole): void {
    if (
      role === OrganizationRole.OWNER &&
      actor.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException('Only owners can manage owners');
    }
  }

  // Only owners may change or remove an owner.
  private assertMayManage(actor: Actor, target: OrganizationMember): void {
    if (
      target.role === OrganizationRole.OWNER &&
      actor.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException('Only owners can manage owners');
    }
  }

  private async assertNotLastOwner(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<void> {
    const owners = await this.organizationMembersService.countOwners(
      tx,
      organizationId,
    );

    if (owners <= 1) {
      throw new ConflictException(
        'An organization must keep at least one owner',
      );
    }
  }

  private toResponse(member: MemberWithUser): MemberResponse {
    return {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      role: member.role,
      joinedAt: member.createdAt.toISOString(),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    return 'code' in error && error.code === 'P2002';
  }
}
