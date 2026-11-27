import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import type {
  DashboardResponse,
  IncidentActivityResponse,
  IncidentDetailResponse,
  IncidentListResponse,
} from '../src/incidents/interfaces/incident-response.interface';
import type { MemberDetailResponse } from '../src/organizations/interfaces/member-response.interface';
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

// One organization going through the main product flow, step by step.
// Later steps use what earlier ones created, so the order matters.
describe('Incident flow (e2e)', () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let engineer: TestUser;
  let viewer: TestUser;
  let base: string;
  let engineerMemberId: string;
  let teamId: string;
  let projectId: string;
  let incidentNumber: number;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);

    owner = await registerUser(app, 'Owner');
    engineer = await registerUser(app, 'Engineer');
    viewer = await registerUser(app, 'Viewer');

    const organizationId = await createOrganization(app, owner, 'Acme');
    base = `/api/v1/organizations/${organizationId}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('owner adds members with roles', async () => {
    const response = await api(app)
      .post(`${base}/members`)
      .set(bearer(owner.accessToken))
      .send({ email: engineer.email, role: 'MEMBER' })
      .expect(201);

    engineerMemberId = (response.body as MemberDetailResponse).member.id;

    await api(app)
      .post(`${base}/members`)
      .set(bearer(owner.accessToken))
      .send({ email: viewer.email, role: 'VIEWER' })
      .expect(201);
  });

  it('owner creates a team and a project', async () => {
    const team = await api(app)
      .post(`${base}/teams`)
      .set(bearer(owner.accessToken))
      .send({ name: 'Payments' })
      .expect(201);

    teamId = (team.body as { team: TeamSummaryResponse }).team.id;

    await api(app)
      .post(`${base}/teams/${teamId}/members`)
      .set(bearer(owner.accessToken))
      .send({ memberId: engineerMemberId })
      .expect(201);

    const project = await api(app)
      .post(`${base}/projects`)
      .set(bearer(owner.accessToken))
      .send({ name: 'Checkout API' })
      .expect(201);

    projectId = (project.body as { project: ProjectResponse }).project.id;
  });

  it('a member reports an incident', async () => {
    const response = await api(app)
      .post(`${base}/incidents`)
      .set(bearer(engineer.accessToken))
      .send({
        title: 'Card payments failing',
        description: 'Checkout returns 502 for card payments.',
        priority: 'HIGH',
        projectId,
      })
      .expect(201);

    const { incident } = response.body as { incident: IncidentDetailResponse };

    expect(incident).toMatchObject({
      number: 1,
      status: 'OPEN',
      priority: 'HIGH',
      project: { id: projectId, name: 'Checkout API' },
      reporter: { userId: engineer.user.id },
    });

    incidentNumber = incident.number;
  });

  it('a viewer can read incidents but not create them', async () => {
    await api(app)
      .get(`${base}/incidents/${incidentNumber}`)
      .set(bearer(viewer.accessToken))
      .expect(200);

    await api(app)
      .post(`${base}/incidents`)
      .set(bearer(viewer.accessToken))
      .send({ title: 'Not allowed' })
      .expect(403);
  });

  it('owner assigns the incident and raises the priority', async () => {
    const response = await api(app)
      .patch(`${base}/incidents/${incidentNumber}`)
      .set(bearer(owner.accessToken))
      .send({
        assigneeId: engineerMemberId,
        assignedTeamId: teamId,
        priority: 'CRITICAL',
      })
      .expect(200);

    expect(
      (response.body as { incident: IncidentDetailResponse }).incident,
    ).toMatchObject({
      priority: 'CRITICAL',
      assignee: { memberId: engineerMemberId },
      assignedTeam: { id: teamId, name: 'Payments' },
    });
  });

  it('the assignee investigates and comments', async () => {
    await api(app)
      .patch(`${base}/incidents/${incidentNumber}`)
      .set(bearer(engineer.accessToken))
      .send({ status: 'INVESTIGATING' })
      .expect(200);

    await api(app)
      .post(`${base}/incidents/${incidentNumber}/comments`)
      .set(bearer(engineer.accessToken))
      .send({ content: 'The payment provider rotated its certificate.' })
      .expect(201);
  });

  it('rejects a status change the workflow does not allow', async () => {
    await api(app)
      .patch(`${base}/incidents/${incidentNumber}`)
      .set(bearer(engineer.accessToken))
      .send({ status: 'CLOSED' })
      .expect(400);
  });

  it('the incident is resolved, then closed', async () => {
    const resolved = await api(app)
      .patch(`${base}/incidents/${incidentNumber}`)
      .set(bearer(engineer.accessToken))
      .send({ status: 'RESOLVED' })
      .expect(200);

    const resolvedIncident = (
      resolved.body as { incident: IncidentDetailResponse }
    ).incident;

    expect(resolvedIncident.resolvedAt).toEqual(expect.any(String));
    expect(resolvedIncident.allowedStatuses).toContain('CLOSED');

    const closed = await api(app)
      .patch(`${base}/incidents/${incidentNumber}`)
      .set(bearer(owner.accessToken))
      .send({ status: 'CLOSED' })
      .expect(200);

    const closedIncident = (closed.body as { incident: IncidentDetailResponse })
      .incident;

    expect(closedIncident.status).toBe('CLOSED');
    expect(closedIncident.closedAt).toEqual(expect.any(String));
  });

  it('records every change in the activity timeline', async () => {
    const response = await api(app)
      .get(`${base}/incidents/${incidentNumber}/activity`)
      .set(bearer(viewer.accessToken))
      .expect(200);

    const types = (
      response.body as { activity: IncidentActivityResponse[] }
    ).activity.map((entry) => entry.type);

    expect(types).toEqual(
      expect.arrayContaining([
        'CREATED',
        'ASSIGNEE_CHANGED',
        'TEAM_CHANGED',
        'PRIORITY_CHANGED',
        'STATUS_CHANGED',
        'COMMENT_ADDED',
      ]),
    );
    expect(types.filter((type) => type === 'STATUS_CHANGED')).toHaveLength(3);
  });

  it('lists incidents with filters and pagination', async () => {
    await api(app)
      .post(`${base}/incidents`)
      .set(bearer(engineer.accessToken))
      .send({ title: 'Slow search results', priority: 'LOW' })
      .expect(201);

    const closed = await api(app)
      .get(`${base}/incidents`)
      .query({ status: 'CLOSED' })
      .set(bearer(owner.accessToken))
      .expect(200);

    const closedList = closed.body as IncidentListResponse;

    expect(closedList.total).toBe(1);
    expect(closedList.incidents[0].number).toBe(incidentNumber);

    const firstPage = await api(app)
      .get(`${base}/incidents`)
      .query({ pageSize: 1, sort: 'number', order: 'asc' })
      .set(bearer(owner.accessToken))
      .expect(200);

    const page = firstPage.body as IncidentListResponse;

    expect(page.total).toBe(2);
    expect(page.incidents).toHaveLength(1);
    expect(page.incidents[0].number).toBe(1);

    const search = await api(app)
      .get(`${base}/incidents`)
      .query({ search: 'search' })
      .set(bearer(owner.accessToken))
      .expect(200);

    expect(
      (search.body as IncidentListResponse).incidents.map((i) => i.title),
    ).toEqual(['Slow search results']);
  });

  it('the dashboard counts active and closed incidents', async () => {
    const response = await api(app)
      .get(`${base}/dashboard`)
      .set(bearer(viewer.accessToken))
      .expect(200);

    const dashboard = response.body as DashboardResponse;

    expect(dashboard.counts.active).toBe(1);
    expect(dashboard.counts.critical).toBe(0);
    expect(dashboard.counts.byStatus.CLOSED).toBe(1);
  });
});
