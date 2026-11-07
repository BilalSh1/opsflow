import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { GuestOnly } from './features/auth/GuestOnly'
import { RequireAuth } from './features/auth/RequireAuth'
import { CreateOrganizationPage } from './pages/CreateOrganizationPage'
import { HomeRedirect } from './pages/HomeRedirect'
import { IncidentPage } from './pages/IncidentPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { LoginPage } from './pages/LoginPage'
import { MembersPage } from './pages/MembersPage'
import { NewIncidentPage } from './pages/NewIncidentPage'
import { OrganizationLayout } from './pages/OrganizationLayout'
import { OrganizationOverview } from './pages/OrganizationOverview'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectsPage } from './pages/ProjectsPage'
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
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="incidents/new" element={<NewIncidentPage />} />
            <Route path="incidents/:number" element={<IncidentPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="teams/:teamId" element={<TeamPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
