import { useMatch, useNavigate } from 'react-router'
import { useOrganizations } from './useOrganizations'

export function OrganizationSwitcher() {
  const { status, organizations } = useOrganizations()
  const navigate = useNavigate()
  const match = useMatch('/organizations/:organizationId/*')

  if (status !== 'ready' || organizations.length === 0) {
    return null
  }

  const currentId = match?.params.organizationId
  const selected = organizations.some((organization) => organization.id === currentId)
    ? currentId
    : ''

  return (
    <select
      className="org-switcher"
      aria-label="Organization"
      value={selected}
      onChange={(event) => navigate(`/organizations/${event.target.value}`)}
    >
      {selected === '' && (
        <option value="" disabled>
          Select organization
        </option>
      )}
      {organizations.map((organization) => (
        <option key={organization.id} value={organization.id}>
          {organization.name}
        </option>
      ))}
    </select>
  )
}
