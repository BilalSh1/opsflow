import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import type {
  OrganizationDetailResponse,
  OrganizationListResponse,
} from '../src/organizations/interfaces/organization-response.interface';
import type { ProjectResponse } from '../src/projects/interfaces/project-response.interface';
import {
  api,
  bearer,
  createOrganization,
  createTestApp,
  registerUser,
  resetDatabase,
  type TestUser,
} from './utils';

describe('Organization settings (e2e)', () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let admin: TestUser;
  let member: TestUser;
  let organizationId: string;
  let base: string;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);

    owner = await registerUser(app, 'Owner');
    admin = await registerUser(app, 'Admin');
    member = await registerUser(app, 'Member');

    organizationId = await createOrganization(app, owner, 'Acme');
    base = `/api/v1/organizations/${organizationId}`;

    for (const [user, role] of [
      [admin, 'ADMIN'],
      [member, 'MEMBER'],
    ] as const) {
      await api(app)
        .post(`${base}/members`)
        .set(bearer(owner.accessToken))
        .send({ email: user.email, role })
        .expect(201);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('rename', () => {
    it('lets admins rename the organization and keeps the slug', async () => {
      const response = await api(app)
        .patch(base)
        .set(bearer(admin.accessToken))
        .send({ name: '  Acme Payments ' })
        .expect(200);

      expect(
        (response.body as OrganizationDetailResponse).organization,
      ).toMatchObject({ name: 'Acme Payments', slug: 'acme', role: 'ADMIN' });

      const list = await api(app)
        .get('/api/v1/organizations')
        .set(bearer(member.accessToken))
        .expect(200);

      expect(
        (list.body as OrganizationListResponse).organizations[0].name,
      ).toBe('Acme Payments');
    });

    it('does not let members rename it', async () => {
      await api(app)
        .patch(base)
        .set(bearer(member.accessToken))
        .send({ name: 'Taken over' })
        .expect(403);
    });

    it('validates the name', async () => {
      await api(app)
        .patch(base)
        .set(bearer(owner.accessToken))
        .send({ name: '   ' })
        .expect(400);
      await api(app)
        .patch(base)
        .set(bearer(owner.accessToken))
        .send({ name: 'x'.repeat(101) })
        .expect(400);
    });
  });

  describe('delete', () => {
    it('does not let admins delete it', async () => {
      await api(app).delete(base).set(bearer(admin.accessToken)).expect(403);
    });

    it('lets the owner delete it with all of its data', async () => {
      const asOwner = bearer(owner.accessToken);

      // Something in every table that belongs to the organization.
      await api(app)
        .post(`${base}/teams`)
        .set(asOwner)
        .send({ name: 'Ops' })
        .expect(201);
      const project = await api(app)
        .post(`${base}/projects`)
        .set(asOwner)
        .send({ name: 'Checkout' })
        .expect(201);
      await api(app)
        .post(`${base}/incidents`)
        .set(asOwner)
        .send({
          title: 'Outage',
          projectId: (project.body as { project: ProjectResponse }).project.id,
        })
        .expect(201);
      await api(app)
        .post(`${base}/incidents/1/comments`)
        .set(asOwner)
        .send({ content: 'Looking into it.' })
        .expect(201);
      await api(app)
        .post(`${base}/invitations`)
        .set(asOwner)
        .send({ email: 'later@example.com', role: 'VIEWER' })
        .expect(201);

      await api(app).delete(base).set(asOwner).expect(204);

      await api(app).get(base).set(asOwner).expect(404);

      for (const user of [owner, admin, member]) {
        const list = await api(app)
          .get('/api/v1/organizations')
          .set(bearer(user.accessToken))
          .expect(200);

        expect((list.body as OrganizationListResponse).organizations).toEqual(
          [],
        );
      }

      // The accounts themselves are kept.
      await api(app).get('/api/v1/auth/me').set(asOwner).expect(200);
    });
  });
});
