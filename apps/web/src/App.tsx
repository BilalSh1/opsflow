import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { GuestOnly } from './features/auth/GuestOnly'
import { RequireAuth } from './features/auth/RequireAuth'
import { CreateOrganizationPage } from './pages/CreateOrganizationPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { OrganizationLayout } from './pages/OrganizationLayout'
import { OrganizationOverview } from './pages/OrganizationOverview'
import { RegisterPage } from './pages/RegisterPage'
import { TeamPage } from './pages/TeamPage'
import { TeamsPage } from './pages/TeamsPage'

function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route
            path="/organizations/new"
            element={<CreateOrganizationPage />}
          />
          <Route
            path="/organizations/:organizationId"
            element={<OrganizationLayout />}
          >
            <Route index element={<OrganizationOverview />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="teams/:teamId" element={<TeamPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
