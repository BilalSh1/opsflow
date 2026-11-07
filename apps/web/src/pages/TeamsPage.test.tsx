import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  json,
  mockFetch,
  noContent,
  session,
  type FetchCall,
} from '../test/fetch-mock'
import { renderApp } from '../test/render-app'
import type { Member } from '../types/member'
import type { Organization, OrganizationRole } from '../types/organization'
import type { TeamDetail, TeamMember } from '../types/team'

const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const base = `/organizations/${organizationId}`

const orgMember = (id: string, firstName: string, role: OrganizationRole): Member => ({
  id,
  userId: `user-${id}`,
  email: `${firstName.toLowerCase()}@example.test`,
  firstName,
  lastName: 'Test',
  role,
  joinedAt: '2026-11-07T10:00:00.000Z',
})

const toTeamMember = (member: Member): TeamMember => ({
  memberId: member.id,
  userId: member.userId,
  email: member.email,
  firstName: member.firstName,
  lastName: member.lastName,
  role: member.role,
  addedAt: '2026-11-07T11:00:00.000Z',
})

const mia = orgMember('m-mia', 'Mia', 'MEMBER')
const vera = orgMember('m-vera', 'Vera', 'VIEWER')

const notFound = (message: string) =>
  json(404, { message, error: 'Not Found', statusCode: 404 })

// A small in-memory API for one organization where the signed-in user has
// `role`. Teams start with Engineering (Mia) and Support (empty).
function fakeApi(role: OrganizationRole, overrides: Record<string, () => Response> = {}) {
  const organization: Organization = {
    id: organizationId,
    name: 'Acme Technologies',
    slug: 'acme-technologies',
    role,
    createdAt: '2026-11-07T10:00:00.000Z',
  }
  const members = [mia, vera]
  const teams: TeamDetail[] = [
    { id: 't-eng', name: 'Engineering', createdAt: '', members: [toTeamMember(mia)] },
    { id: 't-sup', name: 'Support', createdAt: '', members: [] },
  ]
  const summary = (team: TeamDetail) => ({
    id: team.id,
    name: team.name,
    memberCount: team.members.length,
    createdAt: team.createdAt,
  })

  return mockFetch((call: FetchCall) => {
    const override = overrides[`${call.method} ${call.path}`]

    if (override) {
      return override()
    }

    const body = call.body as Record<string, string> | undefined
    const teamMatch = /^\/organizations\/[^/]+\/teams\/([^/]+)(\/members(?:\/(.+))?)?$/.exec(
      call.path,
    )
    const team = teams.find((item) => item.id === teamMatch?.[1])

    switch (`${call.method} ${teamMatch ? 'TEAM' : call.path}`) {
      case 'POST /auth/refresh':
        return json(200, session())
      case 'GET /organizations':
        return json(200, { organizations: [organization] })
      case `GET ${base}`:
        return json(200, { organization })
      case `GET ${base}/members`:
        return json(200, { members })
      case `GET ${base}/teams`:
        return json(200, { teams: teams.map(summary) })
      case `POST ${base}/teams`: {
        const created = { id: 't-new', name: body!.name, createdAt: '', members: [] }
        teams.push(created)
        return json(201, { team: summary(created) })
      }
    }

    if (!team) {
      return notFound('Team not found')
    }

    if (teamMatch![2] === '/members' && call.method === 'POST') {
      const member = members.find((item) => item.id === body!.memberId)!
      team.members.push(toTeamMember(member))
      return json(201, { member: toTeamMember(member) })
    }

    if (teamMatch![3] && call.method === 'DELETE') {
      team.members = team.members.filter((item) => item.memberId !== teamMatch![3])
      return noContent()
    }

    switch (call.method) {
      case 'GET':
        return json(200, { team })
      case 'PATCH':
        team.name = body!.name
        return json(200, { team: summary(team) })
      case 'DELETE':
        teams.splice(teams.indexOf(team), 1)
        return noContent()
      default:
        return json(500, { message: 'unexpected' })
    }
  })
}

describe('teams', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists teams with member counts and hides management from viewers', async () => {
    fakeApi('VIEWER')

    renderApp(`${base}/teams`)

    const engineering = await screen.findByRole('link', { name: 'Engineering' })
    expect(engineering.closest('li')).toHaveTextContent('1 member')
    expect(
      screen.getByRole('link', { name: 'Support' }).closest('li'),
    ).toHaveTextContent('0 members')
    expect(screen.queryByRole('heading', { name: 'Create a team' })).toBeNull()
  })

  it('creates a team', async () => {
    fakeApi('ADMIN')
    const user = userEvent.setup()

    renderApp(`${base}/teams`)

    await user.type(await screen.findByLabelText('Team name'), 'Platform')
    await user.click(screen.getByRole('button', { name: 'Create team' }))

    const links = await screen.findAllByRole('link', {
      name: /Engineering|Platform|Support/,
    })
    expect(links.map((link) => link.textContent)).toEqual([
      'Engineering',
      'Platform',
      'Support',
    ])
  })

  it('shows API errors when creating fails', async () => {
    fakeApi('ADMIN', {
      [`POST ${base}/teams`]: () =>
        json(409, {
          message: 'A team with this name already exists',
          error: 'Conflict',
          statusCode: 409,
        }),
    })
    const user = userEvent.setup()

    renderApp(`${base}/teams`)

    await user.type(await screen.findByLabelText('Team name'), 'Engineering')
    await user.click(screen.getByRole('button', { name: 'Create team' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A team with this name already exists',
    )
  })

  it('opens a team from the list', async () => {
    fakeApi('VIEWER')
    const user = userEvent.setup()

    renderApp(`${base}/teams`)

    await user.click(await screen.findByRole('link', { name: 'Engineering' }))

    expect(
      await screen.findByRole('heading', { name: 'Engineering' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Mia Test' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull()
  })

  it('adds and removes team members', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fakeApi('OWNER')
    const user = userEvent.setup()

    renderApp(`${base}/teams/t-eng`)

    const picker = await screen.findByLabelText('Add a member')
    // Mia is already in the team, so only Vera is offered.
    expect(
      within(picker)
        .getAllByRole('option')
        .filter((option) => !(option as HTMLOptionElement).disabled)
        .map((option) => option.textContent),
    ).toEqual(['Vera Test (vera@example.test)'])

    await user.selectOptions(picker, vera.id)
    await user.click(screen.getByRole('button', { name: 'Add to team' }))

    expect(await screen.findByRole('cell', { name: 'Vera Test' })).toBeInTheDocument()
    expect(
      screen.getByText('Everyone in the organization is already in this team.'),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Remove Mia Test from team' }),
    )

    expect(window.confirm).toHaveBeenCalledWith('Remove Mia Test from Engineering?')
    await vi.waitFor(() =>
      expect(screen.queryByRole('cell', { name: 'Mia Test' })).toBeNull(),
    )
  })

  it('renames a team', async () => {
    fakeApi('ADMIN')
    const user = userEvent.setup()

    renderApp(`${base}/teams/t-eng`)

    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Team name')
    await user.clear(input)
    await user.type(input, 'Platform')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByRole('heading', { name: 'Platform' }),
    ).toBeInTheDocument()
  })

  it('keeps the rename form open when renaming fails', async () => {
    fakeApi('ADMIN', {
      [`PATCH ${base}/teams/t-eng`]: () =>
        json(409, {
          message: 'A team with this name already exists',
          error: 'Conflict',
          statusCode: 409,
        }),
    })
    const user = userEvent.setup()

    renderApp(`${base}/teams/t-eng`)

    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Team name')
    await user.clear(input)
    await user.type(input, 'Support')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A team with this name already exists',
    )
    expect(screen.getByLabelText('Team name')).toHaveValue('Support')
  })

  it('deletes a team after confirmation and returns to the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fakeApi('OWNER')
    const user = userEvent.setup()

    renderApp(`${base}/teams/t-eng`)

    await user.click(await screen.findByRole('button', { name: 'Delete team' }))

    expect(await screen.findByRole('link', { name: 'Support' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Engineering' })).toBeNull()
  })

  it('shows "Team not found" for unknown teams', async () => {
    fakeApi('MEMBER')

    renderApp(`${base}/teams/t-missing`)

    expect(
      await screen.findByRole('heading', { name: 'Team not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← All teams' })).toHaveAttribute(
      'href',
      `${base}/teams`,
    )
  })
})
