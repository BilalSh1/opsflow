import type { MembershipWithOrganization } from '../organizations/interfaces/membership.interface';
import type { IncidentCommentsService } from './incident-comments.service';
import { IncidentsController } from './incidents.controller';
import type { IncidentsService } from './incidents.service';

describe('IncidentsController', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const commentId = '99999999-0000-4000-8000-000000000001';
  const membership = {
    id: 'member-1',
    organizationId,
    userId: 'user-1',
  } as MembershipWithOrganization;
  const incident = { id: 'incident-1', number: 7 };
  const comment = { id: commentId };

  let incidentsMock: jest.Mocked<
    Pick<IncidentsService, 'list' | 'create' | 'get' | 'update'>
  >;
  let commentsMock: jest.Mocked<
    Pick<
      IncidentCommentsService,
      | 'listActivity'
      | 'listComments'
      | 'addComment'
      | 'editComment'
      | 'deleteComment'
    >
  >;
  let controller: IncidentsController;

  beforeEach(() => {
    incidentsMock = {
      list: jest
        .fn()
        .mockResolvedValue({ incidents: [], page: 1, pageSize: 20, total: 0 }),
      create: jest.fn().mockResolvedValue(incident),
      get: jest.fn().mockResolvedValue(incident),
      update: jest.fn().mockResolvedValue(incident),
    };
    commentsMock = {
      listActivity: jest.fn().mockResolvedValue([]),
      listComments: jest.fn().mockResolvedValue([comment]),
      addComment: jest.fn().mockResolvedValue(comment),
      editComment: jest.fn().mockResolvedValue(comment),
      deleteComment: jest.fn().mockResolvedValue(undefined),
    };

    controller = new IncidentsController(
      incidentsMock as unknown as IncidentsService,
      commentsMock as unknown as IncidentCommentsService,
    );
  });

  it('passes the guarded membership and incident number through', async () => {
    const query = { status: [] };

    await controller.list(membership, query);
    await expect(
      controller.create(membership, { title: 'Down' }),
    ).resolves.toEqual({ incident });
    await expect(controller.get(membership, 7)).resolves.toEqual({ incident });
    await controller.update(membership, 7, { title: 'Renamed' });

    expect(incidentsMock.list).toHaveBeenCalledWith(membership, query);
    expect(incidentsMock.create).toHaveBeenCalledWith(membership, {
      title: 'Down',
    });
    expect(incidentsMock.get).toHaveBeenCalledWith(organizationId, 7);
    expect(incidentsMock.update).toHaveBeenCalledWith(membership, 7, {
      title: 'Renamed',
    });
  });

  it('wraps comments and activity', async () => {
    await expect(controller.activity(membership, 7)).resolves.toEqual({
      activity: [],
    });
    await expect(controller.comments(membership, 7)).resolves.toEqual({
      comments: [comment],
    });
    await expect(
      controller.addComment(membership, 7, { content: 'Hi' }),
    ).resolves.toEqual({ comment });
    await controller.editComment(membership, 7, commentId, {
      content: 'Edited',
    });
    await controller.deleteComment(membership, 7, commentId);

    expect(commentsMock.addComment).toHaveBeenCalledWith(membership, 7, 'Hi');
    expect(commentsMock.editComment).toHaveBeenCalledWith(
      membership,
      7,
      commentId,
      'Edited',
    );
    expect(commentsMock.deleteComment).toHaveBeenCalledWith(
      membership,
      7,
      commentId,
    );
  });
});
