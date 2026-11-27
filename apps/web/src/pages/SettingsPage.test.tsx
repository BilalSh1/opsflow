import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, mockFetch, noContent, session } from '../test/fetch-mock'
import { renderApp } from '../test/render-app'
import type { Organization, OrganizationRole } from '../types/organization'

const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const organizationUrl = `/organizations/${organizationId}`
const settingsUrl = `${organizationUrl}/settings`

function setup(
  role: OrganizationRole,
  handlers: Partial<Record<string, () => Response>> = {},
) {
  const organization: Organization = {
    id: organizationId,
    name: 'Acme Technologies',
    slug: 'acme-technologies',
    role,
    createdAt: '2026-11-07T10:00:00.000Z',
  }
  const state = { organizations: [organization] }

  const fetchMock = mockFetch((call) => {
    const handler = handlers[`${call.method} ${call.path}`]

    if (handler) {
      return handler()
    }

    switch (call.path) {
      case '/auth/refresh':
        return json(200, session())
      case '/organizations':
        return json(200, { organizations: state.organizations })
      case organizationUrl:
        return json(200, { organization })
      default:
        return json(500, { message: `Unexpected ${call.method} ${call.path}` })
    }
  })

  return { ...fetchMock, organization, state }
}

describe('SettingsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['MEMBER', 'VIEWER'] as const)(
    'hides settings from %s',
    async (role) => {
      setup(role)

      renderApp(settingsUrl)

      expect(
        await screen.findByText(
          'Only owners and admins can change the organization settings.',
        ),
      ).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull()
    },
  )

  it('lets admins rename but not delete', async () => {
    const { calls, organization } = setup('ADMIN', {
      [`PATCH ${organizationUrl}`]: () =>
        json(200, {
          organization: { ...organization, name: 'Acme Payments' },
        }),
    })
    const user = userEvent.setup()

    renderApp(settingsUrl)

    expect(
      await screen.findByRole('link', { name: 'Settings' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Delete organization' }),
    ).toBeNull()

    const name = screen.getByLabelText('Organization name')
    await user.clear(name)
    await user.type(name, 'Acme Payments')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The organization was renamed.',
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Acme Payments' }),
    ).toBeInTheDocument()
    expect(
      calls.find((call) => call.method === 'PATCH')?.body,
    ).toEqual({ name: 'Acme Payments' })
  })

  it('lets owners delete after typing the name', async () => {
    const { calls, state } = setup('OWNER', {
      [`DELETE ${organizationUrl}`]: () => {
        state.organizations = []
        return noContent()
      },
    })
    const user = userEvent.setup()

    renderApp(settingsUrl)

    const deleteButton = await screen.findByRole('button', {
      name: 'Delete organization',
    })
    expect(deleteButton).toBeDisabled()

    await user.type(
      screen.getByLabelText('Type Acme Technologies to confirm'),
      'Acme Technologies',
    )
    expect(deleteButton).toBeEnabled()
    await user.click(deleteButton)

    // With no organizations left, home sends them to create one.
    expect(
      await screen.findByRole('heading', {
        name: 'Create your first organization',
      }),
    ).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true)
  })
})
