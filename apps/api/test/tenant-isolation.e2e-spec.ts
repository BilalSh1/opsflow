import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import type {
  IncidentCommentResponse,
  IncidentListResponse,
} from '../src/incidents/interfaces/incident-response.interface';
import type {
  MemberDetailResponse,
  MemberListResponse,
} from '../src/organizations/interfaces/member-response.interface';
import type { OrganizationListResponse } from '../src/organizations/interfaces/organization-response.interface';
import type { ProjectResponse } from '../src/projects/interfaces/project-response.interface';
import type { TeamSummaryResponse } from '../src/teams/interfaces/team-response.interface';
import {
  api,
  bearer,
  createOrganization,
  createTestApp,
  registerUser,
  resetDatabase,
  type TestUser,
} from './utils';

// Alice owns organization A, Bob owns organization B. Nothing Bob does
// may read or change A's data, and A's ids are unknown inside B.
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let alice: TestUser;
  let bob: TestUser;
  let orgA: string;
  let orgB: string;
  let aliceMemberId: string;
  let teamA: string;
  let projectA: string;
  let commentA: string;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);

    alice = await registerUser(app, 'Alice');
    bob = await registerUser(app, 'Bob');

    orgA = await createOrganization(app, alice, 'Alpha');
    orgB = await createOrganization(app, bob, 'Beta');

    const a = `/api/v1/organizations/${orgA}`;
    const asAlice = bearer(alice.accessToken);

    const members = await api(app).get(`${a}/members`).set(asAlice);
    aliceMemberId = (members.body as MemberListResponse).members[0].id;

    const team = await api(app)
      .post(`${a}/teams`)
      .set(asAlice)
      .send({ name: 'Alpha team' })
      .expect(201);
    teamA = (team.body as { team: TeamSummaryResponse }).team.id;

    const project = await api(app)
      .post(`${a}/projects`)
      .set(asAlice)
      .send({ name: 'Alpha project' })
      .expect(201);
    projectA = (project.body as { project: ProjectResponse }).project.id;

    await api(app)
      .post(`${a}/incidents`)
      .set(asAlice)
      .send({ title: 'Alpha secret incident', projectId: projectA })
      .expect(201);

    const comment = await api(app)
      .post(`${a}/incidents/1/comments`)
      .set(asAlice)
      .send({ content: 'Alpha internal note' })
      .expect(201);
    commentA = (comment.body as { comment: IncidentCommentResponse }).comment
      .id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('only lists the organizations a user belongs to', async () => {
    const response = await api(app)
      .get('/api/v1/organizations')
      .set(bearer(bob.accessToken))
      .expect(200);

    const ids = (response.body as OrganizationListResponse).organizations.map(
      (organization) => organization.id,
    );

    expect(ids).toEqual([orgB]);
  });

  describe("another organization's routes return 404", () => {
    const routes: [
      method: 'get' | 'post' | 'patch' | 'delete',
      path: string,
    ][] = [
      ['get', ''],
      ['get', '/members'],
      ['post', '/members'],
      ['patch', '/members/:member'],
      ['delete', '/members/:member'],
      ['get', '/teams'],
      ['post', '/teams'],
      ['get', '/teams/:team'],
      ['patch', '/teams/:team'],
      ['delete', '/teams/:team'],
      ['post', '/teams/:team/members'],
      ['get', '/projects'],
      ['post', '/projects'],
      ['get', '/projects/:project'],
      ['patch', '/projects/:project'],
      ['post', '/projects/:project/archive'],
      ['delete', '/projects/:project'],
      ['get', '/incidents'],
      ['post', '/incidents'],
      ['get', '/incidents/1'],
      ['patch', '/incidents/1'],
      ['get', '/incidents/1/activity'],
      ['get', '/incidents/1/comments'],
      ['post', '/incidents/1/comments'],
      ['patch', '/incidents/1/comments/:comment'],
      ['delete', '/incidents/1/comments/:comment'],
      ['get', '/dashboard'],
    ];

    it.each(routes)('%s %s', async (method, path) => {
      const url = `/api/v1/organizations/${orgA}${path}`
        .replace(':member', aliceMemberId)
        .replace(':team', teamA)
        .replace(':project', projectA)
        .replace(':comment', commentA);

      // A valid body, so the 404 comes from the tenant check and not from
      // validation.
      const response = await api(app)
        [method](url)
        .set(bearer(bob.accessToken))
        .send({});

      expect(response.status).toBe(404);
      expect(JSON.stringify(response.body)).not.toContain('Alpha');
    });
  });

  it('requires authentication on organization routes', async () => {
    await api(app).get(`/api/v1/organizations/${orgA}/incidents`).expect(401);
  });

  it("rejects another organization's ids inside your own organization", async () => {
    const b = `/api/v1/organizations/${orgB}`;
    const asBob = bearer(bob.accessToken);

    await api(app)
      .post(`${b}/incidents`)
      .set(asBob)
      .send({ title: 'Uses Alpha project', projectId: projectA })
      .expect(400);

    await api(app)
      .post(`${b}/incidents`)
      .set(asBob)
      .send({ title: 'Uses Alpha team', assignedTeamId: teamA })
      .expect(400);

    await api(app)
      .post(`${b}/incidents`)
      .set(asBob)
      .send({ title: 'Uses Alpha member', assigneeId: aliceMemberId })
      .expect(400);

    await api(app).get(`${b}/teams/${teamA}`).set(asBob).expect(404);
    await api(app).get(`${b}/projects/${projectA}`).set(asBob).expect(404);
    await api(app)
      .patch(`${b}/members/${aliceMemberId}`)
      .set(asBob)
      .send({ role: 'VIEWER' })
      .expect(404);
  });

  it('numbers incidents per organization without exposing other ones', async () => {
    const b = `/api/v1/organizations/${orgB}`;

    await api(app)
      .post(`${b}/incidents`)
      .set(bearer(bob.accessToken))
      .send({ title: 'Beta incident' })
      .expect(201);

    const response = await api(app)
      .get(`${b}/incidents`)
      .set(bearer(bob.accessToken))
      .expect(200);

    const list = response.body as IncidentListResponse;

    expect(list.total).toBe(1);
    expect(list.incidents[0]).toMatchObject({
      number: 1,
      title: 'Beta incident',
    });
  });

  it('a removed member loses access immediately', async () => {
    const a = `/api/v1/organizations/${orgA}`;

    const added = await api(app)
      .post(`${a}/members`)
      .set(bearer(alice.accessToken))
      .send({ email: bob.email, role: 'MEMBER' })
      .expect(201);
    const bobMemberId = (added.body as MemberDetailResponse).member.id;

    await api(app)
      .get(`${a}/incidents/1`)
      .set(bearer(bob.accessToken))
      .expect(200);

    await api(app)
      .delete(`${a}/members/${bobMemberId}`)
      .set(bearer(alice.accessToken))
      .expect(204);

    await api(app)
      .get(`${a}/incidents/1`)
      .set(bearer(bob.accessToken))
      .expect(404);
  });
});
