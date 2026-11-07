import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { json, mockFetch, session, testUser } from '../../test/fetch-mock'
import { renderApp } from '../../test/render-app'
import type { Organization } from '../../types/organization'
import { rememberLastOrganizationId } from './last-organization'

const acme: Organization = {
  id: '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  name: 'Acme Technologies',
  slug: 'acme-technologies',
  role: 'OWNER',
  createdAt: '2026-11-07T10:00:00.000Z',
}

const globex: Organization = {
  id: '9ee01174-2b34-4fd5-8811-e309eb75a47b',
  name: 'Globex',
  slug: 'globex',
  role: 'VIEWER',
  createdAt: '2026-11-06T10:00:00.000Z',
}

const notFound = () =>
  json(404, { message: 'Organization not found', error: 'Not Found', statusCode: 404 })

// Signed-in user whose GET /organizations returns `organizations` (newest
// first, like the API); single organizations are served from the same list.
function mockSignedIn(organizations: Organization[]) {
  return mockFetch((call) => {
    if (call.path === '/auth/refresh') {
      return json(200, session())
    }

    if (call.path === '/organizations' && call.method === 'GET') {
      return json(200, { organizations })
    }

    const match = /^\/organizations\/(.+)$/.exec(call.path)
    const organization = organizations.find((item) => item.id === match?.[1])

    return organization ? json(200, { organization }) : notFound()
  })
}

const switcher = () => screen.findByRole('combobox', { name: 'Organization' })

describe('organizations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('opens the newest organization when none was used before', async () => {
    mockSignedIn([acme, globex])

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: acme.name }),
    ).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(await switcher()).toHaveValue(acme.id)
  })

  it('opens the organization this user used last', async () => {
    rememberLastOrganizationId(testUser.id, globex.id)
    mockSignedIn([acme, globex])

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: globex.name }),
    ).toBeInTheDocument()
    expect(screen.getByText('Viewer')).toBeInTheDocument()
  })

  it('ignores a remembered organization the user no longer belongs to', async () => {
    rememberLastOrganizationId(testUser.id, 'b6f1d0c2-9e8a-4b7c-8d6e-5f4a3b2c1d0e')
    mockSignedIn([acme])

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: acme.name }),
    ).toBeInTheDocument()
  })

  it('switches organizations from the header', async () => {
    mockSignedIn([acme, globex])
    const user = userEvent.setup()

    renderApp(`/organizations/${acme.id}`)

    await screen.findByRole('heading', { name: acme.name })
    await user.selectOptions(await switcher(), globex.id)

    expect(
      await screen.findByRole('heading', { name: globex.name }),
    ).toBeInTheDocument()
    expect(await switcher()).toHaveValue(globex.id)
  })

  it('shows "not found" for organizations the user cannot open', async () => {
    mockSignedIn([acme])

    renderApp('/organizations/00000000-0000-4000-8000-000000000000')

    expect(
      await screen.findByRole('heading', { name: 'Organization not found' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Go to your organizations' }),
    ).toHaveAttribute('href', '/')
  })

  it('creates the first organization and adds it to the switcher', async () => {
    const organizations: Organization[] = []
    const { calls } = mockFetch((call) => {
      if (call.path === '/auth/refresh') {
        return json(200, session())
      }

      if (call.path === '/organizations' && call.method === 'POST') {
        organizations.push(acme)
        return json(201, { organization: acme })
      }

      if (call.path === '/organizations') {
        return json(200, { organizations: [] })
      }

      return json(200, { organization: acme })
    })
    const user = userEvent.setup()

    renderApp('/')

    await user.type(
      await screen.findByLabelText('Organization name'),
      acme.name,
    )
    await user.click(screen.getByRole('button', { name: 'Create organization' }))

    expect(
      await screen.findByRole('heading', { name: acme.name }),
    ).toBeInTheDocument()
    expect(
      within(await switcher()).getByRole('option', { name: acme.name }),
    ).toBeInTheDocument()
    expect(
      calls.find((call) => call.method === 'POST' && call.path === '/organizations')
        ?.body,
    ).toEqual({ name: acme.name })
    expect(organizations).toHaveLength(1)
  })

  it('shows API validation errors on the create form', async () => {
    mockFetch((call) => {
      if (call.path === '/auth/refresh') {
        return json(200, session())
      }

      if (call.method === 'POST') {
        return json(400, {
          message: ['name must not be empty'],
          error: 'Bad Request',
          statusCode: 400,
        })
      }

      return json(200, { organizations: [] })
    })
    const user = userEvent.setup()

    renderApp('/organizations/new')

    await user.type(await screen.findByLabelText('Organization name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Create organization' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'name must not be empty',
    )
  })
})
