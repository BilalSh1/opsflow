import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  InvitationStatus,
  type Invitation,
  type OrganizationMember,
  type OrganizationRole,
  type User,
} from '../generated/prisma/client';
import type { OrganizationResponse } from '../organizations/interfaces/organization-response.interface';
import { OrganizationMembersService } from '../organizations/organization-members.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { mayGrantRole } from '../organizations/permissions/permissions';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_MS,
  isInvitationToken,
} from './invitation-token';
import type {
  CreatedInvitationResponse,
  InvitationPreviewResponse,
  InvitationResponse,
  InvitationState,
  InviterRef,
} from './interfaces/invitation-response.interface';

// The acting user's membership in the organization (from the guard).
type Actor = Pick<OrganizationMember, 'organizationId' | 'userId' | 'role'>;

type InvitationWithInviter = Invitation & {
  invitedBy: Pick<User, 'firstName' | 'lastName'> | null;
};

const inviterFields = {
  select: { firstName: true, lastName: true },
} as const;

const NOT_FOUND = 'Invitation not found';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMembersService: OrganizationMembersService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async listPending(organizationId: string): Promise<InvitationResponse[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { organizationId, status: InvitationStatus.PENDING },
      include: { invitedBy: inviterFields },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    return invitations.map((invitation) => this.toResponse(invitation, now));
  }

  // Inviting an email that already has a pending invitation replaces its
  // token, role and expiry, so the new link is the only one that works.
  async create(
    actor: Actor,
    email: string,
    role: OrganizationRole,
  ): Promise<CreatedInvitationResponse> {
    if (!mayGrantRole(actor.role, role)) {
      throw new ForbiddenException('Only owners can invite owners');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { token, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation =
      await this.organizationMembersService.withOrganizationLock(
        actor.organizationId,
        async (tx) => {
          const existingMember = await tx.organizationMember.findFirst({
            where: {
              organizationId: actor.organizationId,
              user: { email: normalizedEmail },
            },
          });

          if (existingMember) {
            throw new ConflictException('This person is already a member');
          }

          const pending = await tx.invitation.findFirst({
            where: {
              organizationId: actor.organizationId,
              email: normalizedEmail,
              status: InvitationStatus.PENDING,
            },
          });

          const data = {
            role,
            tokenHash,
            expiresAt,
            invitedById: actor.userId,
          };

          return pending
            ? tx.invitation.update({
                where: { id: pending.id },
                data,
                include: { invitedBy: inviterFields },
              })
            : tx.invitation.create({
                data: {
                  ...data,
                  organizationId: actor.organizationId,
                  email: normalizedEmail,
                },
                include: { invitedBy: inviterFields },
              });
        },
      );

    return { invitation: this.toResponse(invitation, new Date()), token };
  }

  async revoke(organizationId: string, invitationId: string): Promise<void> {
    const { count } = await this.prisma.invitation.updateMany({
      where: {
        id: invitationId,
        organizationId,
        status: InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.REVOKED, respondedAt: new Date() },
    });

    if (count === 0) {
      throw new NotFoundException(NOT_FOUND);
    }
  }

  // Public: anyone with the link may see whom it invites and where.
  async preview(token: string): Promise<InvitationPreviewResponse> {
    const invitation = await this.findByToken(token);

    return {
      invitation: {
        email: invitation.email,
        role: invitation.role,
        state: this.stateOf(invitation, new Date()),
        organization: { name: invitation.organization.name },
        invitedBy: this.inviterOf(invitation),
        expiresAt: invitation.expiresAt.toISOString(),
      },
    };
  }

  // Needs both the link and an account with the invited email, so a
  // forwarded link cannot be used by someone else's account, and knowing
  // an email is not enough without the link.
  async accept(token: string, userId: string): Promise<OrganizationResponse> {
    const invitation = await this.findByToken(token);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    if (user.email !== invitation.email) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    return this.organizationMembersService.withOrganizationLock(
      invitation.organizationId,
      async (tx) => {
        // Re-read under the lock: it may have been revoked or used since.
        const current = await tx.invitation.findUniqueOrThrow({
          where: { id: invitation.id },
        });
        const now = new Date();

        this.assertPending(current, now);

        const existing = await this.organizationMembersService.findByUser(
          tx,
          current.organizationId,
          userId,
        );

        // Someone who joined another way meanwhile keeps their current role.
        if (!existing) {
          await tx.organizationMember.create({
            data: {
              organizationId: current.organizationId,
              userId,
              role: current.role,
            },
          });
        }

        await tx.invitation.update({
          where: { id: current.id },
          data: { status: InvitationStatus.ACCEPTED, respondedAt: now },
        });

        const membership = await tx.organizationMember.findUniqueOrThrow({
          where: {
            organizationId_userId: {
              organizationId: current.organizationId,
              userId,
            },
          },
          include: { organization: true },
        });

        return this.organizationsService.toMembershipResponse(membership);
      },
    );
  }

  // Public, so people can decline without creating an account.
  async decline(token: string): Promise<void> {
    const invitation = await this.findByToken(token);
    const now = new Date();

    this.assertPending(invitation, now);

    const { count } = await this.prisma.invitation.updateMany({
      where: { id: invitation.id, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.DECLINED, respondedAt: now },
    });

    if (count === 0) {
      throw new GoneException('This invitation is no longer valid');
    }
  }

  private async findByToken(token: string) {
    const invitation = isInvitationToken(token)
      ? await this.prisma.invitation.findUnique({
          where: { tokenHash: hashInvitationToken(token) },
          include: { organization: true, invitedBy: inviterFields },
        })
      : null;

    if (!invitation) {
      throw new NotFoundException(NOT_FOUND);
    }

    return invitation;
  }

  private assertPending(invitation: Invitation, now: Date): void {
    if (this.stateOf(invitation, now) !== InvitationStatus.PENDING) {
      throw new GoneException('This invitation is no longer valid');
    }
  }

  private stateOf(invitation: Invitation, now: Date): InvitationState {
    if (
      invitation.status === InvitationStatus.PENDING &&
      invitation.expiresAt.getTime() <= now.getTime()
    ) {
      return 'EXPIRED';
    }

    return invitation.status;
  }

  private inviterOf(invitation: InvitationWithInviter): InviterRef | null {
    return invitation.invitedBy
      ? {
          firstName: invitation.invitedBy.firstName,
          lastName: invitation.invitedBy.lastName,
        }
      : null;
  }

  private toResponse(
    invitation: InvitationWithInviter,
    now: Date,
  ): InvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      invitedBy: this.inviterOf(invitation),
      expiresAt: invitation.expiresAt.toISOString(),
      expired: this.stateOf(invitation, now) === 'EXPIRED',
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}
