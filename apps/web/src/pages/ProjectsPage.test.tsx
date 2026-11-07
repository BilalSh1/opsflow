import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, mockFetch, noContent, session, type FetchCall } from '../test/fetch-mock'
import { renderApp } from '../test/render-app'
import type { Organization, OrganizationRole } from '../types/organization'
import type { Project } from '../types/project'

const organizationId = '3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const base = `/organizations/${organizationId}`

const projectOf = (id: string, name: string, extra: Partial<Project> = {}): Project => ({
  id,
  name,
  description: null,
  archivedAt: null,
  createdAt: '2026-11-07T10:00:00.000Z',
  updatedAt: '2026-11-07T10:00:00.000Z',
  ...extra,
})

const conflict = (message: string) =>
  json(409, { message, error: 'Conflict', statusCode: 409 })

// In-memory projects API for one organization where the user has `role`.
// Starts with Payments (active, described) and Legacy (archived).
function fakeApi(role: OrganizationRole, overrides: Record<string, () => Response> = {}) {
  const organization: Organization = {
    id: organizationId,
    name: 'Acme Technologies',
    slug: 'acme-technologies',
    role,
    createdAt: '2026-11-07T10:00:00.000Z',
  }
  const projects: Project[] = [
    projectOf('p-pay', 'Payments', { description: 'Card processing' }),
    projectOf('p-old', 'Legacy', { archivedAt: '2026-11-07T11:00:00.000Z' }),
  ]

  return mockFetch((call: FetchCall) => {
    const override = overrides[`${call.method} ${call.path}`]

    if (override) {
      return override()
    }

    const body = call.body as Record<string, string | null> | undefined
    const match = /^\/organizations\/[^/]+\/projects\/([^/?]+)(?:\/(archive|unarchive))?$/.exec(
      call.path,
    )
    const project = projects.find((item) => item.id === match?.[1])

    switch (`${call.method} ${match ? 'PROJECT' : call.path}`) {
      case 'POST /auth/refresh':
        return json(200, session())
      case 'GET /organizations':
        return json(200, { organizations: [organization] })
      case `GET ${base}`:
        return json(200, { organization })
      case `GET ${base}/projects`:
        return json(200, { projects: projects.filter((item) => !item.archivedAt) })
      case `GET ${base}/projects?archived=true`:
        return json(200, { projects: projects.filter((item) => item.archivedAt) })
      case `POST ${base}/projects`: {
        const created = projectOf('p-new', body!.name!, {
          description: body!.description ?? null,
        })
        projects.push(created)
        return json(201, { project: created })
      }
    }

    if (!project) {
      return json(404, { message: 'Project not found', error: 'Not Found', statusCode: 404 })
    }

    if (match![2]) {
      project.archivedAt = match![2] === 'archive' ? '2026-11-07T12:00:00.000Z' : null
      return json(200, { project })
    }

    switch (call.method) {
      case 'GET':
        return json(200, { project })
      case 'PATCH':
        Object.assign(project, body)
        return json(200, { project })
      case 'DELETE':
        projects.splice(projects.indexOf(project), 1)
        return noContent()
      default:
        return json(500, { message: 'unexpected' })
    }
  })
}

describe('projects', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows active projects to viewers without management controls', async () => {
    fakeApi('VIEWER')

    renderApp(`${base}/projects`)

    const payments = await screen.findByRole('link', { name: 'Payments' })
    expect(payments.closest('li')).toHaveTextContent('Card processing')
    expect(screen.queryByRole('link', { name: 'Legacy' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Create a project' })).toBeNull()
  })

  it('switches to archived projects', async () => {
    fakeApi('VIEWER')
    const user = userEvent.setup()

    renderApp(`${base}/projects`)

    await screen.findByRole('link', { name: 'Payments' })
    await user.click(screen.getByRole('button', { name: 'Archived' }))

    expect(await screen.findByRole('link', { name: 'Legacy' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Payments' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Archived' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('creates a project with an optional description', async () => {
    const { calls } = fakeApi('ADMIN')
    const user = userEvent.setup()

    renderApp(`${base}/projects`)

    await user.type(await screen.findByLabelText('Project name'), 'Mobile App')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByRole('link', { name: 'Mobile App' })).toBeInTheDocument()
    expect(
      calls.find((call) => call.method === 'POST' && call.path === `${base}/projects`)
        ?.body,
    ).toEqual({ name: 'Mobile App' })
  })

  it('shows API errors when creating fails', async () => {
    fakeApi('ADMIN', {
      [`POST ${base}/projects`]: () => conflict('A project with this name already exists'),
    })
    const user = userEvent.setup()

    renderApp(`${base}/projects`)

    await user.type(await screen.findByLabelText('Project name'), 'Payments')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A project with this name already exists',
    )
  })

  it('opens a project read-only for members', async () => {
    fakeApi('MEMBER')
    const user = userEvent.setup()

    renderApp(`${base}/projects`)

    await user.click(await screen.findByRole('link', { name: 'Payments' }))

    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument()
    expect(screen.getByText('Card processing')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  })

  it('edits a project and clears its description', async () => {
    const { calls } = fakeApi('OWNER')
    const user = userEvent.setup()

    renderApp(`${base}/projects/p-pay`)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const name = screen.getByLabelText('Project name')
    await user.clear(name)
    await user.type(name, 'Billing')
    await user.clear(screen.getByLabelText('Description'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Billing' })).toBeInTheDocument()
    expect(screen.getByText('No description.')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      name: 'Billing',
      description: null,
    })
  })

  it('keeps the edit form open when saving fails', async () => {
    fakeApi('OWNER', {
      [`PATCH ${base}/projects/p-pay`]: () =>
        conflict('A project with this name already exists'),
    })
    const user = userEvent.setup()

    renderApp(`${base}/projects/p-pay`)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const name = screen.getByLabelText('Project name')
    await user.clear(name)
    await user.type(name, 'Legacy')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A project with this name already exists',
    )
    expect(screen.getByLabelText('Project name')).toHaveValue('Legacy')
  })

  it('archives and restores a project', async () => {
    fakeApi('ADMIN')
    const user = userEvent.setup()

    renderApp(`${base}/projects/p-pay`)

    await user.click(await screen.findByRole('button', { name: 'Archive' }))

    expect(await screen.findByText('Archived', { selector: '.badge' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore' }))

    expect(await screen.findByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.queryByText('Archived', { selector: '.badge' })).toBeNull()
  })

  it('deletes a project after confirmation and returns to the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fakeApi('OWNER')
    const user = userEvent.setup()

    renderApp(`${base}/projects/p-pay`)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(window.confirm).toHaveBeenCalledWith(
      'Delete the project Payments? This cannot be undone.',
    )
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument()
  })

  it('shows the API error when a project cannot be deleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fakeApi('OWNER', {
      [`DELETE ${base}/projects/p-pay`]: () =>
        conflict('This project is still in use. Archive it instead.'),
    })
    const user = userEvent.setup()

    renderApp(`${base}/projects/p-pay`)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This project is still in use. Archive it instead.',
    )
  })

  it('shows "Project not found" for unknown projects', async () => {
    fakeApi('VIEWER')

    renderApp(`${base}/projects/p-missing`)

    expect(
      await screen.findByRole('heading', { name: 'Project not found' }),
    ).toBeInTheDocument()
  })
})
