import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  json,
  mockFetch,
  noContent,
  session,
  testUser,
  type FetchCall,
} from '../test/fetch-mock'
import { renderApp } from '../test/render-app'
import type {
  IncidentActivity,
  IncidentComment,
  IncidentDetail,
  IncidentStatus,
} from '../types/incident'
import type { Member } from '../types/member'
import type { Organization, OrganizationRole } from '../types/organization'

const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const base = `/organizations/${organizationId}`

const TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['INVESTIGATING', 'BLOCKED', 'RESOLVED'],
  INVESTIGATING: ['OPEN', 'BLOCKED', 'RESOLVED'],
  BLOCKED: ['OPEN', 'INVESTIGATING', 'RESOLVED'],
  RESOLVED: ['INVESTIGATING', 'CLOSED'],
  CLOSED: ['OPEN'],
}

const member = (id: string, firstName: string, userId = `user-${id}`): Member => ({
  id,
  userId,
  email: `${firstName.toLowerCase()}@example.test`,
  firstName,
  lastName: 'Test',
  role: 'MEMBER',
  joinedAt: '2026-11-07T10:00:00.000Z',
})

const me = member('m-self', testUser.firstName, testUser.id)
const mia = member('m-mia', 'Mia')

const incidentOf = (
  number: number,
  title: string,
  overrides: Partial<IncidentDetail> = {},
): IncidentDetail => {
  const status = overrides.status ?? 'OPEN'

  return {
    id: `i-${number}`,
    number,
    title,
    status,
    priority: 'MEDIUM',
    project: null,
    assignee: null,
    assignedTeam: null,
    createdAt: `2026-11-07T10:0${number}:00.000Z`,
    updatedAt: `2026-11-07T10:0${number}:00.000Z`,
    description: null,
    reporter: { userId: testUser.id, firstName: 'Ada', lastName: 'Lovelace' },
    resolvedAt: null,
    closedAt: null,
    allowedStatuses: TRANSITIONS[status],
    ...overrides,
  }
}

// An in-memory incidents API for one organization where the user has `role`.
function fakeApi(
  role: OrganizationRole,
  {
    incidents = [
      incidentOf(1, 'Payment API returning 500 errors', { priority: 'CRITICAL' }),
      incidentOf(2, 'Slow dashboard'),
    ],
    comments = [] as IncidentComment[],
    total,
  }: { incidents?: IncidentDetail[]; comments?: IncidentComment[]; total?: number } = {},
) {
  const organization: Organization = {
    id: organizationId,
    name: 'Acme Technologies',
    slug: 'acme-technologies',
    role,
    createdAt: '2026-11-07T10:00:00.000Z',
  }
  const activity: IncidentActivity[] = []
  let seq = 0
  const at = () => `2026-11-07T12:${String(seq++).padStart(2, '0')}:00.000Z`

  const api = mockFetch((call: FetchCall) => {
    const body = call.body as Record<string, string | null> | undefined
    const [path, query = ''] = call.path.split('?')
    const params = new URLSearchParams(query)
    const match = /^\/organizations\/[^/]+\/incidents\/(\d+)(\/(comments|activity))?(?:\/([^/]+))?$/.exec(
      path,
    )
    const incident = incidents.find((item) => item.number === Number(match?.[1]))

    switch (`${call.method} ${match ? 'INCIDENT' : path}`) {
      case 'POST /auth/refresh':
        return json(200, session())
      case 'GET /organizations':
        return json(200, { organizations: [organization] })
      case `GET ${base}`:
        return json(200, { organization })
      case `GET ${base}/members`:
        return json(200, { members: [me, mia] })
      case `GET ${base}/projects`:
        return json(200, {
          projects: [{ id: 'p-pay', name: 'Payments', description: null, archivedAt: null, createdAt: '', updatedAt: '' }],
        })
      case `GET ${base}/teams`:
        return json(200, {
          teams: [{ id: 't-eng', name: 'Engineering', memberCount: 1, createdAt: '' }],
        })
      case `GET ${base}/dashboard`:
        return json(200, {
          counts: {
            byStatus: { OPEN: 2, INVESTIGATING: 1, BLOCKED: 0, RESOLVED: 0, CLOSED: 4 },
            active: 3,
            critical: 1,
          },
          recentlyCreated: incidents.slice(0, 2),
          recentlyUpdated: incidents.slice(0, 1),
        })
      case `GET ${base}/incidents`: {
        const statuses = params.get('status')?.split(',')
        const list = statuses
          ? incidents.filter((item) => statuses.includes(item.status))
          : incidents
        return json(200, {
          incidents: list,
          page: Number(params.get('page') ?? 1),
          pageSize: 20,
          total: total ?? list.length,
        })
      }
      case `POST ${base}/incidents`: {
        const assignee = [me, mia].find((item) => item.id === body!.assigneeId)
        const created = incidentOf(incidents.length + 1, body!.title!, {
          priority: (body!.priority as IncidentDetail['priority']) ?? 'MEDIUM',
          assignee: assignee
            ? { memberId: assignee.id, userId: assignee.userId, firstName: assignee.firstName, lastName: assignee.lastName }
            : null,
        })
        incidents.push(created)
        return json(201, { incident: created })
      }
    }

    if (!incident) {
      return json(404, { message: 'Incident not found', error: 'Not Found', statusCode: 404 })
    }

    const actor = { userId: testUser.id, firstName: 'Ada', lastName: 'Lovelace' }

    if (match![3] === 'activity') {
      return json(200, { activity })
    }

    if (match![3] === 'comments') {
      const commentId = match![4]

      if (call.method === 'GET') {
        return json(200, { comments })
      }

      if (call.method === 'POST') {
        const comment: IncidentComment = {
          id: `c-${comments.length + 1}`,
          content: body!.content!,
          author: actor,
          createdAt: at(),
          updatedAt: '',
          edited: false,
        }
        comment.updatedAt = comment.createdAt
        comments.push(comment)
        return json(201, { comment })
      }

      const index = comments.findIndex((item) => item.id === commentId)

      if (call.method === 'PATCH') {
        comments[index] = { ...comments[index], content: body!.content!, edited: true }
        return json(200, { comment: comments[index] })
      }

      comments.splice(index, 1)
      return noContent()
    }

    if (call.method === 'GET') {
      return json(200, { incident })
    }

    // PATCH: apply status and priority like the API, recording activity.
    if (body!.status) {
      activity.push({
        id: `a-${activity.length + 1}`,
        type: 'STATUS_CHANGED',
        actor,
        oldValue: incident.status,
        newValue: body!.status,
        createdAt: at(),
      })
      incident.status = body!.status as IncidentStatus
      incident.allowedStatuses = TRANSITIONS[incident.status]
    }

    if (body!.priority) {
      incident.priority = body!.priority as IncidentDetail['priority']
    }

    return json(200, { incident })
  })

  return api
}

const incidentCalls = (calls: FetchCall[]) =>
  calls.filter((call) => call.method === 'GET' && call.path.startsWith(`${base}/incidents?`))

const lastQuery = (calls: FetchCall[]) =>
  Object.fromEntries(new URLSearchParams(incidentCalls(calls).at(-1)!.path.split('?')[1]))

describe('incidents list', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists active incidents by default', async () => {
    const { calls } = fakeApi('MEMBER')

    renderApp(`${base}/incidents`)

    const first = await screen.findByRole('link', {
      name: 'Payment API returning 500 errors',
    })
    expect(first.closest('li')).toHaveTextContent('INC-1')
    expect(first.closest('li')).toHaveTextContent('Critical')
    expect(lastQuery(calls)).toMatchObject({
      status: 'OPEN,INVESTIGATING,BLOCKED',
      sort: 'updatedAt',
      order: 'desc',
      page: '1',
    })
    expect(screen.getByRole('link', { name: 'New incident' })).toBeInTheDocument()
  })

  it('sends filters, search and sorting to the API', async () => {
    const { calls } = fakeApi('MEMBER')
    const user = userEvent.setup()

    renderApp(`${base}/incidents`)
    await screen.findByRole('link', { name: 'Slow dashboard' })

    await user.selectOptions(screen.getByLabelText('Priority'), 'CRITICAL')
    await user.selectOptions(screen.getByLabelText('Assignee'), 'me')
    await user.selectOptions(screen.getByLabelText('Status'), 'all')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'priority')
    await user.type(screen.getByRole('searchbox'), 'INC-1')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await vi.waitFor(() =>
      expect(lastQuery(calls)).toEqual({
        priority: 'CRITICAL',
        assigneeId: 'me',
        search: 'INC-1',
        sort: 'priority',
        order: 'desc',
        page: '1',
        pageSize: '20',
      }),
    )
  })

  it('pages through results', async () => {
    const { calls } = fakeApi('VIEWER', { total: 45 })
    const user = userEvent.setup()

    renderApp(`${base}/incidents`)

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    await vi.waitFor(() => expect(lastQuery(calls).page).toBe('2'))
    expect(screen.queryByRole('link', { name: 'New incident' })).toBeNull()
  })
})

describe('reporting an incident', () => {
  it('creates an incident and opens it', async () => {
    const { calls } = fakeApi('MEMBER')
    const user = userEvent.setup()

    renderApp(`${base}/incidents/new`)

    await user.type(await screen.findByLabelText('Title'), 'Login errors')
    await user.selectOptions(screen.getByLabelText('Priority'), 'HIGH')
    await vi.waitFor(() =>
      expect(within(screen.getByLabelText('Assignee')).getAllByRole('option')).toHaveLength(3),
    )
    await user.selectOptions(screen.getByLabelText('Assignee'), mia.id)
    await user.click(screen.getByRole('button', { name: 'Report incident' }))

    expect(await screen.findByRole('heading', { name: 'Login errors' })).toBeInTheDocument()
    expect(screen.getByText('INC-3')).toBeInTheDocument()
    expect(
      calls.find((call) => call.method === 'POST' && call.path === `${base}/incidents`)?.body,
    ).toEqual({ title: 'Login errors', priority: 'HIGH', assigneeId: mia.id })
  })
})

describe('incident page', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offers only allowed status changes and records them in the timeline', async () => {
    const { calls } = fakeApi('MEMBER')
    const user = userEvent.setup()

    renderApp(`${base}/incidents/1`)

    const status = await screen.findByRole('combobox', { name: 'Status' })
    expect(
      within(status)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Open', 'Investigating', 'Blocked', 'Resolved'])

    await user.selectOptions(status, 'INVESTIGATING')

    expect(
      await screen.findByText('Ada Lovelace changed status from Open to Investigating.'),
    ).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      status: 'INVESTIGATING',
    })
  })

  it('keeps closed incidents read-only except for reopening', async () => {
    fakeApi('MEMBER', {
      incidents: [incidentOf(1, 'Old outage', { status: 'CLOSED' })],
    })

    renderApp(`${base}/incidents/1`)

    const status = await screen.findByRole('combobox', { name: 'Status' })
    expect(within(status).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Closed',
      'Open',
    ])
    expect(screen.queryByRole('combobox', { name: 'Priority' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.getByText(/Closed incidents are read-only/)).toBeInTheDocument()
  })

  it('adds, edits and deletes your own comments only', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fakeApi('MEMBER', {
      comments: [
        {
          id: 'c-mia',
          content: 'Checking the logs',
          author: { userId: mia.userId, firstName: 'Mia', lastName: 'Test' },
          createdAt: '2026-11-07T11:00:00.000Z',
          updatedAt: '2026-11-07T11:00:00.000Z',
          edited: false,
        },
      ],
    })
    const user = userEvent.setup()

    renderApp(`${base}/incidents/1`)

    const miasComment = (await screen.findByText('Checking the logs')).closest('li')!
    expect(within(miasComment).queryByRole('button', { name: 'Edit' })).toBeNull()

    await user.type(screen.getByLabelText('Add a comment'), 'Rolled back the deploy')
    await user.click(screen.getByRole('button', { name: 'Comment' }))

    const mine = (await screen.findByText('Rolled back the deploy')).closest('li')!
    await user.click(within(mine).getByRole('button', { name: 'Edit' }))
    const editor = within(mine).getByLabelText('Edit comment')
    await user.clear(editor)
    await user.type(editor, 'Rolled back deploy 4521')
    await user.click(within(mine).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Rolled back deploy 4521')).toBeInTheDocument()
    expect(screen.getByText(/\(edited\)/)).toBeInTheDocument()

    const edited = screen.getByText('Rolled back deploy 4521').closest('li')!
    await user.click(within(edited).getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() =>
      expect(screen.queryByText('Rolled back deploy 4521')).toBeNull(),
    )
    expect(screen.getByText('Checking the logs')).toBeInTheDocument()
  })

  it('is read-only for viewers', async () => {
    fakeApi('VIEWER')

    renderApp(`${base}/incidents/1`)

    expect(
      await screen.findByRole('heading', { name: 'Payment API returning 500 errors' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Status' })).toBeNull()
    expect(screen.queryByLabelText('Add a comment')).toBeNull()
  })

  it('shows "Incident not found" for unknown numbers', async () => {
    fakeApi('MEMBER')

    renderApp(`${base}/incidents/99`)

    expect(
      await screen.findByRole('heading', { name: 'Incident not found' }),
    ).toBeInTheDocument()
  })
})

describe('dashboard', () => {
  it('shows incident counts and recent incidents', async () => {
    fakeApi('VIEWER')

    renderApp(base)

    const active = await screen.findByText('Active incidents')
    expect(active.closest('a')).toHaveTextContent('3')
    expect(screen.getByText('Active critical').closest('a')).toHaveTextContent('1')
    expect(
      screen.getByRole('list', { name: 'Incidents by status' }),
    ).toHaveTextContent('Closed 4')

    const created = screen.getByRole('heading', { name: 'Recently created' }).closest('section')!
    expect(within(created).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'INC-1 Payment API returning 500 errors',
      'INC-2 Slow dashboard',
    ])
  })
})
