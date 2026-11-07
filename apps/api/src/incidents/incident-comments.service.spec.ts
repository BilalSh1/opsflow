import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IncidentActivityType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentCommentsService } from './incident-comments.service';

describe('IncidentCommentsService', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const actor = {
    organizationId,
    userId: 'bbbbbbbb-0000-4000-8000-000000000001',
  };
  const incidentId = 'ffffffff-0000-4000-8000-000000000001';
  const commentId = '99999999-0000-4000-8000-000000000001';
  const createdAt = new Date('2026-11-07T10:00:00.000Z');

  const commentRow = (overrides: Record<string, unknown> = {}) => ({
    id: commentId,
    incidentId,
    authorId: actor.userId,
    content: 'Rolled back the deploy',
    createdAt,
    updatedAt: createdAt,
    author: { id: actor.userId, firstName: 'Ada', lastName: 'Lovelace' },
    ...overrides,
  });

  let prismaMock: {
    $transaction: jest.Mock;
    incident: Record<'findFirst' | 'update', jest.Mock>;
    incidentComment: Record<
      | 'findMany'
      | 'findFirst'
      | 'findUniqueOrThrow'
      | 'create'
      | 'update'
      | 'delete',
      jest.Mock
    >;
    incidentActivity: Record<'findMany' | 'create', jest.Mock>;
  };
  let service: IncidentCommentsService;

  beforeEach(() => {
    prismaMock = {
      $transaction: jest.fn((work: (tx: unknown) => unknown) =>
        work(prismaMock),
      ),
      incident: {
        findFirst: jest.fn().mockResolvedValue({ id: incidentId }),
        update: jest.fn().mockResolvedValue({}),
      },
      incidentComment: {
        findMany: jest.fn().mockResolvedValue([commentRow()]),
        findFirst: jest.fn().mockResolvedValue(commentRow()),
        findUniqueOrThrow: jest.fn().mockResolvedValue(commentRow()),
        create: jest.fn().mockResolvedValue(commentRow()),
        update: jest.fn((args: { data: { content: string } }) =>
          Promise.resolve(
            commentRow({
              content: args.data.content,
              updatedAt: new Date('2026-11-07T11:00:00.000Z'),
            }),
          ),
        ),
        delete: jest.fn().mockResolvedValue({}),
      },
      incidentActivity: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    service = new IncidentCommentsService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('lists comments oldest first', async () => {
    const [comment] = await service.listComments(organizationId, 7);

    expect(prismaMock.incident.findFirst).toHaveBeenCalledWith({
      where: { organizationId, number: 7 },
      select: { id: true },
    });
    expect(comment).toEqual({
      id: commentId,
      content: 'Rolled back the deploy',
      author: { userId: actor.userId, firstName: 'Ada', lastName: 'Lovelace' },
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      edited: false,
    });
  });

  it('returns 404 for an incident of another organization', async () => {
    prismaMock.incident.findFirst.mockResolvedValue(null);

    await expect(service.listActivity(organizationId, 7)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('adds a comment, records it in the activity and touches the incident', async () => {
    await service.addComment(actor, 7, '  Rolled back the deploy ');

    expect(prismaMock.incidentComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          incidentId,
          authorId: actor.userId,
          content: 'Rolled back the deploy',
        },
      }),
    );
    expect(prismaMock.incidentActivity.create).toHaveBeenCalledWith({
      data: {
        incidentId,
        actorId: actor.userId,
        type: IncidentActivityType.COMMENT_ADDED,
      },
    });
    expect(prismaMock.incident.update).toHaveBeenCalledWith({
      where: { id: incidentId },
      data: { updatedAt: expect.any(Date) as Date },
    });
  });

  it('lets the author edit their comment and marks it edited', async () => {
    const result = await service.editComment(actor, 7, commentId, 'Fixed now');

    expect(prismaMock.incidentComment.findFirst).toHaveBeenCalledWith({
      where: { id: commentId, incident: { organizationId, number: 7 } },
    });
    expect(result).toMatchObject({ content: 'Fixed now', edited: true });
  });

  it('does not write when the content is unchanged', async () => {
    await service.editComment(actor, 7, commentId, ' Rolled back the deploy ');

    expect(prismaMock.incidentComment.update).not.toHaveBeenCalled();
  });

  it("does not let anyone change someone else's comment", async () => {
    prismaMock.incidentComment.findFirst.mockResolvedValue(
      commentRow({ authorId: 'someone-else' }),
    );

    await expect(
      service.editComment(actor, 7, commentId, 'Hijacked'),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.deleteComment(actor, 7, commentId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prismaMock.incidentComment.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for a comment on another incident or organization', async () => {
    prismaMock.incidentComment.findFirst.mockResolvedValue(null);

    await expect(service.deleteComment(actor, 7, commentId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes the author’s own comment', async () => {
    await service.deleteComment(actor, 7, commentId);

    expect(prismaMock.incidentComment.delete).toHaveBeenCalledWith({
      where: { id: commentId },
    });
  });
});
