import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IncidentActivityType,
  type IncidentComment,
  type OrganizationMember,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  activityInclude,
  commentInclude,
  toActivityResponse,
  toCommentResponse,
} from './incident-mapper';
import type {
  IncidentActivityResponse,
  IncidentCommentResponse,
} from './interfaces/incident-response.interface';

type Actor = Pick<OrganizationMember, 'organizationId' | 'userId'>;

// Comments and the activity timeline of one incident. Only a comment's
// author may edit or delete it.
@Injectable()
export class IncidentCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listComments(
    organizationId: string,
    number: number,
  ): Promise<IncidentCommentResponse[]> {
    const incidentId = await this.findIncidentId(organizationId, number);
    const comments = await this.prisma.incidentComment.findMany({
      where: { incidentId },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
    });

    return comments.map(toCommentResponse);
  }

  async listActivity(
    organizationId: string,
    number: number,
  ): Promise<IncidentActivityResponse[]> {
    const incidentId = await this.findIncidentId(organizationId, number);
    const activities = await this.prisma.incidentActivity.findMany({
      where: { incidentId },
      include: activityInclude,
      orderBy: { createdAt: 'asc' },
    });

    return activities.map(toActivityResponse);
  }

  // Adding a comment is recorded in the activity history and counts as an
  // update to the incident.
  async addComment(
    actor: Actor,
    number: number,
    content: string,
  ): Promise<IncidentCommentResponse> {
    const incidentId = await this.findIncidentId(actor.organizationId, number);

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.incidentComment.create({
        data: { incidentId, authorId: actor.userId, content: content.trim() },
        include: commentInclude,
      });

      await tx.incidentActivity.create({
        data: {
          incidentId,
          actorId: actor.userId,
          type: IncidentActivityType.COMMENT_ADDED,
        },
      });

      await tx.incident.update({
        where: { id: incidentId },
        data: { updatedAt: new Date() },
      });

      return toCommentResponse(comment);
    });
  }

  async editComment(
    actor: Actor,
    number: number,
    commentId: string,
    content: string,
  ): Promise<IncidentCommentResponse> {
    const comment = await this.findOwnComment(actor, number, commentId);
    const trimmed = content.trim();

    const updated =
      trimmed === comment.content
        ? await this.prisma.incidentComment.findUniqueOrThrow({
            where: { id: comment.id },
            include: commentInclude,
          })
        : await this.prisma.incidentComment.update({
            where: { id: comment.id },
            data: { content: trimmed },
            include: commentInclude,
          });

    return toCommentResponse(updated);
  }

  async deleteComment(
    actor: Actor,
    number: number,
    commentId: string,
  ): Promise<void> {
    const comment = await this.findOwnComment(actor, number, commentId);

    await this.prisma.incidentComment.delete({ where: { id: comment.id } });
  }

  private async findIncidentId(
    organizationId: string,
    number: number,
  ): Promise<string> {
    const incident = await this.prisma.incident.findFirst({
      where: { organizationId, number },
      select: { id: true },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return incident.id;
  }

  private async findOwnComment(
    actor: Actor,
    number: number,
    commentId: string,
  ): Promise<IncidentComment> {
    const comment = await this.prisma.incidentComment.findFirst({
      where: {
        id: commentId,
        incident: { organizationId: actor.organizationId, number },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== actor.userId) {
      throw new ForbiddenException('You can only change your own comments');
    }

    return comment;
  }
}
