import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  json,
  mockFetch,
  noContent,
  session,
  testUser,
  unauthorized,
} from '../test/fetch-mock'
import { renderApp } from '../test/render-app'
import type { InvitationPreview } from '../types/invitation'
import type { Organization } from '../types/organization'

const token = 'A'.repeat(43)
const invitationUrl = `/invitations/${token}`

const organization: Organization = {
  id: '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  name: 'Acme Technologies',
  slug: 'acme-technologies',
  role: 'MEMBER',
  createdAt: '2026-11-07T10:00:00.000Z',
}

const preview = (
  overrides: Partial<InvitationPreview> = {},
): InvitationPreview => ({
  email: testUser.email,
  role: 'MEMBER',
  state: 'PENDING',
  organization: { name: organization.name },
  invitedBy: { firstName: 'Olivia', lastName: 'Owner' },
  expiresAt: '2026-11-14T10:00:00.000Z',
  ...overrides,
})

function setup({
  loggedIn,
  invitation = preview(),
  handlers = {},
}: {
  loggedIn: boolean
  invitation?: InvitationPreview | null
  handlers?: Partial<Record<string, () => Response>>
}) {
  return mockFetch((call) => {
    const handler = handlers[`${call.method} ${call.path}`]

    if (handler) {
      return handler()
    }

    switch (call.path) {
      case '/auth/refresh':
        return loggedIn ? json(200, session()) : unauthorized()
      case invitationUrl:
        return invitation
          ? json(200, { invitation })
          : json(404, { message: 'Invitation not found', statusCode: 404 })
      case '/organizations':
        return json(200, { organizations: [organization] })
      case `/organizations/${organization.id}`:
        return json(200, { organization })
      default:
        return json(500, { message: `Unexpected ${call.method} ${call.path}` })
    }
  })
}

describe('InvitationPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks people who are logged out to sign up or log in', async () => {
    setup({ loggedIn: false })

    renderApp(invitationUrl)

    expect(
      await screen.findByRole('heading', { name: 'Join Acme Technologies' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Olivia Owner invited/),
    ).toHaveTextContent(`invited ${testUser.email} to join Acme Technologies as member`)
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register',
    )
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Accept invitation' }),
    ).toBeNull()
  })

  it('accepts and opens the organization', async () => {
    const { calls } = setup({
      loggedIn: true,
      handlers: {
        [`POST ${invitationUrl}/accept`]: () => json(200, { organization }),
      },
    })
    const user = userEvent.setup()

    renderApp(invitationUrl)

    await user.click(
      await screen.findByRole('button', { name: 'Accept invitation' }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: organization.name }),
    ).toBeInTheDocument()
    expect(
      calls.some((call) => call.method === 'POST' && call.path === `${invitationUrl}/accept`),
    ).toBe(true)
  })

  it('explains when the invitation is for another email', async () => {
    setup({
      loggedIn: true,
      invitation: preview({ email: 'someone@example.test' }),
    })

    renderApp(invitationUrl)

    expect(
      await screen.findByText(/You are logged in as ada@example.test/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Accept invitation' }),
    ).toBeNull()
  })

  it('declines and shows the result', async () => {
    let declined = false
    setup({
      loggedIn: false,
      handlers: {
        [`POST ${invitationUrl}/decline`]: () => {
          declined = true
          return noContent()
        },
        [`GET ${invitationUrl}`]: () =>
          json(200, {
            invitation: preview({ state: declined ? 'DECLINED' : 'PENDING' }),
          }),
      },
    })
    const user = userEvent.setup()

    renderApp(invitationUrl)

    await user.click(await screen.findByRole('button', { name: 'Decline' }))

    expect(
      await screen.findByText('This invitation was declined.'),
    ).toBeInTheDocument()
  })

  it.each([
    ['EXPIRED', 'This invitation has expired.'],
    ['REVOKED', 'This invitation was withdrawn.'],
    ['ACCEPTED', 'This invitation has already been accepted.'],
  ] as const)('shows a %s invitation as closed', async (state, message) => {
    setup({ loggedIn: true, invitation: preview({ state }) })

    renderApp(invitationUrl)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).toBeNull()
  })

  it('reports an unknown link', async () => {
    setup({ loggedIn: false, invitation: null })

    renderApp(invitationUrl)

    expect(
      await screen.findByText('This invitation link is not valid.'),
    ).toBeInTheDocument()
  })
})
