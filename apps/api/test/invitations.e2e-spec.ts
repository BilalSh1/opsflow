import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import type {
  AcceptedInvitationResponse,
  CreatedInvitationResponse,
  InvitationListResponse,
  InvitationPreviewResponse,
} from '../src/invitations/interfaces/invitation-response.interface';
import type { OrganizationListResponse } from '../src/organizations/interfaces/organization-response.interface';
import {
  api,
  bearer,
  createOrganization,
  createTestApp,
  registerUser,
  resetDatabase,
  type TestUser,
} from './utils';

describe('Invitations (e2e)', () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let base: string;

  const invite = async (email: string, role = 'MEMBER') => {
    const response = await api(app)
      .post(`${base}/invitations`)
      .set(bearer(owner.accessToken))
      .send({ email, role })
      .expect(201);

    return response.body as CreatedInvitationResponse;
  };

  const preview = async (token: string) => {
    const response = await api(app).get(`/api/v1/invitations/${token}`);

    return {
      status: response.status,
      body: response.body as InvitationPreviewResponse,
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);

    owner = await registerUser(app, 'Owner');
    const organizationId = await createOrganization(app, owner, 'Acme');
    base = `/api/v1/organizations/${organizationId}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('invites someone without an account, who signs up and joins', async () => {
    const { token, invitation } = await invite('Maya@Example.com');

    expect(invitation).toMatchObject({
      email: 'maya@example.com',
      role: 'MEMBER',
      expired: false,
    });

    // Anyone holding the link can see where it leads, without logging in.
    await expect(preview(token)).resolves.toMatchObject({
      status: 200,
      body: {
        invitation: {
          email: 'maya@example.com',
          role: 'MEMBER',
          state: 'PENDING',
          organization: { name: 'Acme' },
          invitedBy: { firstName: 'Owner' },
        },
      },
    });

    const pending = await api(app)
      .get(`${base}/invitations`)
      .set(bearer(owner.accessToken))
      .expect(200);

    expect(
      (pending.body as InvitationListResponse).invitations.map((i) => i.email),
    ).toEqual(['maya@example.com']);

    await api(app).post(`/api/v1/invitations/${token}/accept`).expect(401);

    const maya = await registerUser(app, 'Maya');

    const accepted = await api(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set(bearer(maya.accessToken))
      .expect(200);

    expect(
      (accepted.body as AcceptedInvitationResponse).organization,
    ).toMatchObject({ name: 'Acme', role: 'MEMBER' });

    const organizations = await api(app)
      .get('/api/v1/organizations')
      .set(bearer(maya.accessToken))
      .expect(200);

    expect(
      (organizations.body as OrganizationListResponse).organizations,
    ).toHaveLength(1);

    // Members (not admins) cannot see or manage invitations.
    await api(app)
      .get(`${base}/invitations`)
      .set(bearer(maya.accessToken))
      .expect(403);

    // The link works once.
    await api(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set(bearer(maya.accessToken))
      .expect(410);
    await expect(preview(token)).resolves.toMatchObject({
      body: { invitation: { state: 'ACCEPTED' } },
    });
  });

  it('only the invited email can accept, even with the link', async () => {
    const { token } = await invite('lior@example.com');
    const intruder = await registerUser(app, 'Intruder');

    await api(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set(bearer(intruder.accessToken))
      .expect(403);

    await expect(preview(token)).resolves.toMatchObject({
      body: { invitation: { state: 'PENDING' } },
    });
  });

  it('inviting the same email again replaces the old link', async () => {
    const first = await invite('tal@example.com', 'VIEWER');
    const second = await invite('tal@example.com', 'ADMIN');

    expect(second.invitation.id).toBe(first.invitation.id);
    expect((await preview(first.token)).status).toBe(404);
    await expect(preview(second.token)).resolves.toMatchObject({
      body: { invitation: { role: 'ADMIN', state: 'PENDING' } },
    });
  });

  it('revoked invitations can no longer be accepted', async () => {
    const { token, invitation } = await invite('noa@example.com');
    const noa = await registerUser(app, 'Noa');

    await api(app)
      .delete(`${base}/invitations/${invitation.id}`)
      .set(bearer(owner.accessToken))
      .expect(204);

    await api(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set(bearer(noa.accessToken))
      .expect(410);
    await expect(preview(token)).resolves.toMatchObject({
      body: { invitation: { state: 'REVOKED' } },
    });
  });

  it('can be declined without an account', async () => {
    const { token } = await invite('yael@example.com');

    await api(app).post(`/api/v1/invitations/${token}/decline`).expect(204);

    await expect(preview(token)).resolves.toMatchObject({
      body: { invitation: { state: 'DECLINED' } },
    });
    await api(app).post(`/api/v1/invitations/${token}/decline`).expect(410);
  });

  it('rejects inviting an existing member', async () => {
    await api(app)
      .post(`${base}/invitations`)
      .set(bearer(owner.accessToken))
      .send({ email: owner.email, role: 'MEMBER' })
      .expect(409);
  });

  it('returns 404 for an unknown or malformed token', async () => {
    expect((await preview('A'.repeat(43))).status).toBe(404);
    expect((await preview('nope')).status).toBe(404);
  });
});
