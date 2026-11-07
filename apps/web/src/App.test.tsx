import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'
import { AuthProvider } from './features/auth/AuthProvider'
import {
  json,
  mockFetch,
  noContent,
  session,
  testUser,
  unauthorized,
  type FetchCall,
} from './test/fetch-mock'

function renderApp(path = '/') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </StrictMode>,
  )
}

const refreshCalls = (calls: FetchCall[]) =>
  calls.filter((call) => call.path === '/auth/refresh')

describe('App authentication', () => {
  it('restores the session with a single refresh, even in StrictMode', async () => {
    const { calls } = mockFetch(() => json(200, session()))

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: `Welcome, ${testUser.firstName}` }),
    ).toBeInTheDocument()
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
    const { calls } = mockFetch((call) =>
      call.path === '/auth/login' ? json(200, session()) : unauthorized(),
    )
    const user = userEvent.setup()

    renderApp('/')

    await user.type(await screen.findByLabelText('Email'), testUser.email)
    await user.type(screen.getByLabelText('Password'), 'CorrectPassword1!')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByRole('heading', { name: `Welcome, ${testUser.firstName}` }),
    ).toBeInTheDocument()
    expect(calls.find((call) => call.path === '/auth/login')?.body).toEqual({
      email: testUser.email,
      password: 'CorrectPassword1!',
    })
  })

  it('registers, logs in automatically, and logs out', async () => {
    const { calls } = mockFetch((call) => {
      switch (call.path) {
        case '/auth/register':
          return json(201, { user: testUser })
        case '/auth/login':
          return json(200, session())
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

    expect(
      await screen.findByRole('heading', { name: `Welcome, ${testUser.firstName}` }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(
      await screen.findByRole('heading', { name: 'Log in to OpsFlow' }),
    ).toBeInTheDocument()
    expect(calls.map((call) => call.path)).toEqual([
      '/auth/refresh',
      '/auth/register',
      '/auth/login',
      '/auth/logout',
    ])
  })
})
