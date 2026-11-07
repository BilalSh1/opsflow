import { roleLabels } from '../features/organizations/permissions'
import { useCurrentOrganization } from '../features/organizations/useCurrentOrganization'

export function OrganizationOverview() {
  const { organization } = useCurrentOrganization()

  return (
    <dl className="details">
      <dt>Slug</dt>
      <dd>{organization.slug}</dd>

      <dt>Your role</dt>
      <dd>{roleLabels[organization.role]}</dd>

      <dt>Created</dt>
      <dd>
        {new Date(organization.createdAt).toLocaleDateString(undefined, {
          dateStyle: 'medium',
        })}
      </dd>
    </dl>
  )
}
