import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  json,
  mockFetch,
  noContent,
  session,
  testUser,
  unauthorized,
  type FetchCall,
} from './test/fetch-mock'
import { renderApp } from './test/render-app'

const refreshCalls = (calls: FetchCall[]) =>
  calls.filter((call) => call.path === '/auth/refresh')

// A signed-in user with no organizations lands on the create page.
const noOrganizations = () => json(200, { organizations: [] })
const firstOrganizationHeading = () =>
  screen.findByRole('heading', { name: 'Create your first organization' })

describe('App authentication', () => {
  it('restores the session with a single refresh, even in StrictMode', async () => {
    const { calls } = mockFetch((call) =>
      call.path === '/organizations' ? noOrganizations() : json(200, session()),
    )

    renderApp('/')

    expect(await firstOrganizationHeading()).toBeInTheDocument()
    expect(refreshCalls(calls)).toHaveLength(1)
  })

  it('sends signed-out users to the login page', async () => {
    mockFetch(() => unauthorized())

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'Log in to OpsFlow' }),
    ).toBeInTheDocument()
  })

  it('shows the API error when login fails', async () => {
    mockFetch((call) =>
      call.path === '/auth/login'
        ? unauthorized('Invalid email or password')
        : unauthorized(),
    )
    const user = userEvent.setup()

    renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), testUser.email)
    await user.type(screen.getByLabelText('Password'), 'WrongPassword1!')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    )
  })

  it('redirects to login and back to the protected page after logging in', async () => {
    const { calls } = mockFetch((call) => {
      switch (call.path) {
        case '/auth/login':
          return json(200, session())
        case '/organizations':
          return noOrganizations()
        default:
          return unauthorized()
      }
    })
    const user = userEvent.setup()

    renderApp('/organizations/new')

    await user.type(await screen.findByLabelText('Email'), testUser.email)
    await user.type(screen.getByLabelText('Password'), 'CorrectPassword1!')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await firstOrganizationHeading()).toBeInTheDocument()
    expect(calls.find((call) => call.path === '/auth/login')?.body).toEqual({
      email: testUser.email,
      password: 'CorrectPassword1!',
    })
  })

  describe('where login leads', () => {
    const elsewhere = '/organizations/3b0e8f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

    // Signed in until logout; the organization page itself is a 404.
    const api = () => {
      let signedIn = true

      return mockFetch((call) => {
        switch (call.path) {
          case '/auth/refresh':
            return signedIn ? json(200, session()) : unauthorized()
          case '/auth/login':
            signedIn = true
            return json(200, session())
          case '/auth/logout':
            signedIn = false
            return noContent()
          case '/organizations':
            return noOrganizations()
          default:
            return json(404, { message: 'Organization not found', statusCode: 404 })
        }
      })
    }

    const logIn = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(await screen.findByLabelText('Email'), testUser.email)
      await user.type(screen.getByLabelText('Password'), 'CorrectPassword1!')
      await user.click(screen.getByRole('button', { name: 'Log in' }))
    }

    it('returns to the requested page when the session had expired', async () => {
      mockFetch((call) =>
        call.path === '/auth/login'
          ? json(200, session())
          : call.path === '/organizations'
            ? noOrganizations()
            : call.path === '/auth/refresh'
              ? unauthorized()
              : json(404, { message: 'Organization not found', statusCode: 404 }),
      )
      const user = userEvent.setup()

      renderApp(elsewhere)
      await logIn(user)

      expect(
        await screen.findByRole('heading', { name: 'Organization not found' }),
      ).toBeInTheDocument()
    })

    it('starts from home after a deliberate logout', async () => {
      api()
      const user = userEvent.setup()

      renderApp(elsewhere)
      await user.click(await screen.findByRole('button', { name: 'Log out' }))
      await logIn(user)

      expect(await firstOrganizationHeading()).toBeInTheDocument()
    })
  })

  it('registers, logs in automatically, and logs out', async () => {
    const { calls } = mockFetch((call) => {
      switch (call.path) {
        case '/auth/register':
          return json(201, { user: testUser })
        case '/auth/login':
          return json(200, session())
        case '/organizations':
          return noOrganizations()
        case '/auth/logout':
          return noContent()
        default:
          return unauthorized()
      }
    })
    const user = userEvent.setup()

    renderApp('/register')

    await user.type(await screen.findByLabelText('First name'), testUser.firstName)
    await user.type(screen.getByLabelText('Last name'), testUser.lastName)
    await user.type(screen.getByLabelText('Email'), testUser.email)
    await user.type(screen.getByLabelText('Password'), 'CorrectPassword1!')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await firstOrganizationHeading()).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(
      await screen.findByRole('heading', { name: 'Log in to OpsFlow' }),
    ).toBeInTheDocument()
    // StrictMode loads the organization list twice in development; only the
    // order of distinct calls matters here.
    expect([...new Set(calls.map((call) => call.path))]).toEqual([
      '/auth/refresh',
      '/auth/register',
      '/auth/login',
      '/organizations',
      '/auth/logout',
    ])
  })
})
