import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, mockFetch, noContent, session, testUser } from '../test/fetch-mock'
import { renderApp } from '../test/render-app'
import type { Member } from '../types/member'
import type { Organization, OrganizationRole } from '../types/organization'

const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const membersUrl = `/organizations/${organizationId}/members`

const memberOf = (
  id: string,
  firstName: string,
  role: OrganizationRole,
  userId = `user-${id}`,
): Member => ({
  id,
  userId,
  email: `${firstName.toLowerCase()}@example.test`,
  firstName,
  lastName: 'Test',
  role,
  joinedAt: '2026-11-07T10:00:00.000Z',
})

const otherOwner = memberOf('m-owner', 'Olivia', 'OWNER')
const otherMember = memberOf('m-member', 'Mia', 'MEMBER')

// The signed-in user (testUser) with `role`, plus the other members.
function setup(role: OrganizationRole, handlers: Partial<Record<string, () => Response>> = {}) {
  const self = memberOf('m-self', testUser.firstName, role, testUser.id)
  const organization: Organization = {
    id: organizationId,
    name: 'Acme Technologies',
    slug: 'acme-technologies',
    role,
    createdAt: '2026-11-07T10:00:00.000Z',
  }

  const fetchMock = mockFetch((call) => {
    const handler = handlers[`${call.method} ${call.path}`]

    if (handler) {
      return handler()
    }

    switch (call.path) {
      case '/auth/refresh':
        return json(200, session())
      case '/organizations':
        return json(200, { organizations: [organization] })
      case `/organizations/${organizationId}`:
        return json(200, { organization })
      case `/organizations/${organizationId}/members`:
        return json(200, { members: [otherOwner, self, otherMember] })
      default:
        return json(500, { message: `Unexpected ${call.method} ${call.path}` })
    }
  })

  return { ...fetchMock, self, organization }
}

const rowFor = async (name: string) =>
  (await screen.findByRole('cell', { name: new RegExp(`^${name} Test`) })).closest(
    'tr',
  ) as HTMLElement

describe('MembersPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a read-only list to viewers, with a leave button for themselves', async () => {
    setup('VIEWER')

    renderApp(membersUrl)

    expect(await rowFor('Olivia')).toHaveTextContent('Owner')
    expect(screen.queryByRole('heading', { name: 'Add a member' })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /Role for/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Leave organization' }),
    ).toBeInTheDocument()
  })

  it('lets admins manage non-owners but not owners', async () => {
    setup('ADMIN')

    renderApp(membersUrl)

    const ownerRow = await rowFor('Olivia')
    expect(within(ownerRow).queryByRole('combobox')).toBeNull()
    expect(within(ownerRow).queryByRole('button')).toBeNull()

    const memberSelect = screen.getByRole('combobox', {
      name: 'Role for Mia Test',
    })
    expect(
      within(memberSelect).queryByRole('option', { name: 'Owner' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Remove Mia Test' }),
    ).toBeInTheDocument()
  })

  it('adds a member by email', async () => {
    const newcomer = memberOf('m-new', 'Nora', 'VIEWER')
    const { calls } = setup('ADMIN', {
      [`POST ${membersUrl}`]: () => json(201, { member: newcomer }),
    })
    const user = userEvent.setup()

    renderApp(membersUrl)

    await user.type(await screen.findByLabelText('Email'), newcomer.email)
    await user.selectOptions(screen.getByLabelText('Role'), 'VIEWER')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Nora Test was added.',
    )
    expect(await rowFor('Nora')).toHaveTextContent(newcomer.email)
    expect(
      calls.find((call) => call.method === 'POST' && call.path === membersUrl)
        ?.body,
    ).toEqual({ email: newcomer.email, role: 'VIEWER' })
  })

  it('shows the API error when adding fails', async () => {
    setup('OWNER', {
      [`POST ${membersUrl}`]: () =>
        json(404, {
          message: 'No account found with this email',
          error: 'Not Found',
          statusCode: 404,
        }),
    })
    const user = userEvent.setup()

    renderApp(membersUrl)

    await user.type(await screen.findByLabelText('Email'), 'nobody@example.test')
    await user.click(screen.getByRole('button', { name: 'Add member' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No account found with this email',
    )
  })

  it('changes a role', async () => {
    const { calls } = setup('OWNER', {
      [`PATCH ${membersUrl}/${otherMember.id}`]: () =>
        json(200, { member: { ...otherMember, role: 'ADMIN' } }),
    })
    const user = userEvent.setup()

    renderApp(membersUrl)

    const select = await screen.findByRole('combobox', {
      name: 'Role for Mia Test',
    })
    await user.selectOptions(select, 'ADMIN')

    expect(
      await screen.findByRole('combobox', { name: 'Role for Mia Test' }),
    ).toHaveValue('ADMIN')
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      role: 'ADMIN',
    })
  })

  it('shows "keep at least one owner" errors from the API', async () => {
    const { self } = setup('OWNER', {
      [`PATCH ${membersUrl}/m-self`]: () =>
        json(409, {
          message: 'An organization must keep at least one owner',
          error: 'Conflict',
          statusCode: 409,
        }),
    })
    const user = userEvent.setup()

    renderApp(membersUrl)

    await user.selectOptions(
      await screen.findByRole('combobox', {
        name: `Role for ${self.firstName} Test`,
      }),
      'ADMIN',
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An organization must keep at least one owner',
    )
  })

  it('removes a member after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = setup('ADMIN', {
      [`DELETE ${membersUrl}/${otherMember.id}`]: () => noContent(),
    })
    const user = userEvent.setup()

    renderApp(membersUrl)

    await user.click(
      await screen.findByRole('button', { name: 'Remove Mia Test' }),
    )

    expect(window.confirm).toHaveBeenCalledWith(
      'Remove Mia Test from Acme Technologies?',
    )
    await vi.waitFor(() =>
      expect(screen.queryByRole('cell', { name: /^Mia Test/ })).toBeNull(),
    )
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true)
  })

  it('does nothing when removal is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { calls } = setup('ADMIN')
    const user = userEvent.setup()

    renderApp(membersUrl)

    await user.click(
      await screen.findByRole('button', { name: 'Remove Mia Test' }),
    )

    expect(await rowFor('Mia')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
  })

  it('leaves the organization and returns home', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setup('MEMBER', {
      [`DELETE ${membersUrl}/m-self`]: () => noContent(),
    })
    const user = userEvent.setup()

    renderApp(membersUrl)

    await user.click(
      await screen.findByRole('button', { name: 'Leave organization' }),
    )

    // No organizations remain in the list, so home sends them to create one.
    expect(
      await screen.findByRole('heading', {
        name: 'Create your first organization',
      }),
    ).toBeInTheDocument()
  })
})
