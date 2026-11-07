import type { MembershipWithOrganization } from '../organizations/interfaces/membership.interface';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

describe('ProjectsController', () => {
  const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const projectId = 'abcdef00-0000-4000-8000-000000000001';
  const membership = { organizationId } as MembershipWithOrganization;
  const project = { id: projectId, name: 'Payments' };

  let serviceMock: jest.Mocked<
    Pick<
      ProjectsService,
      'list' | 'create' | 'get' | 'update' | 'setArchived' | 'remove'
    >
  >;
  let controller: ProjectsController;

  beforeEach(() => {
    serviceMock = {
      list: jest.fn().mockResolvedValue([project]),
      create: jest.fn().mockResolvedValue(project),
      get: jest.fn().mockResolvedValue(project),
      update: jest.fn().mockResolvedValue(project),
      setArchived: jest.fn().mockResolvedValue(project),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    controller = new ProjectsController(
      serviceMock as unknown as ProjectsService,
    );
  });

  it('lists active projects unless archived ones are requested', async () => {
    await expect(controller.list(membership, undefined)).resolves.toEqual({
      projects: [project],
    });
    await controller.list(membership, true);

    expect(serviceMock.list).toHaveBeenNthCalledWith(1, organizationId, false);
    expect(serviceMock.list).toHaveBeenNthCalledWith(2, organizationId, true);
  });

  it('scopes every other call to the guarded organization', async () => {
    const dto = { name: 'Payments' };

    await expect(controller.create(membership, dto)).resolves.toEqual({
      project,
    });
    await controller.get(membership, projectId);
    await controller.update(membership, projectId, { description: null });
    await controller.archive(membership, projectId);
    await controller.unarchive(membership, projectId);
    await controller.remove(membership, projectId);

    expect(serviceMock.create).toHaveBeenCalledWith(organizationId, dto);
    expect(serviceMock.get).toHaveBeenCalledWith(organizationId, projectId);
    expect(serviceMock.update).toHaveBeenCalledWith(organizationId, projectId, {
      description: null,
    });
    expect(serviceMock.setArchived).toHaveBeenNthCalledWith(
      1,
      organizationId,
      projectId,
      true,
    );
    expect(serviceMock.setArchived).toHaveBeenNthCalledWith(
      2,
      organizationId,
      projectId,
      false,
    );
    expect(serviceMock.remove).toHaveBeenCalledWith(organizationId, projectId);
  });
});
