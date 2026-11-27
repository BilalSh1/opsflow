import { expect, test } from '@playwright/test'
import { signUpWithOrganization } from './helpers.ts'

test('report, investigate, comment on and resolve an incident', async ({
  page,
}) => {
  await signUpWithOrganization(page, 'Olivia', 'Acme Payments')

  await page.getByRole('link', { name: 'Incidents', exact: true }).click()
  await page.getByRole('link', { name: 'New incident' }).click()

  await page.getByLabel('Title').fill('Checkout returns 502')
  await page
    .getByLabel('Description (optional)')
    .fill('Card payments fail since the 14:00 deploy.')
  await page.getByLabel('Priority').selectOption('HIGH')
  await page.getByRole('button', { name: 'Report incident' }).click()

  await expect(
    page.getByRole('heading', { name: 'Checkout returns 502' }),
  ).toBeVisible()
  await expect(page.getByText('Olivia Test created the incident.')).toBeVisible()

  const details = page.getByRole('complementary', { name: 'Details' })

  await details.getByLabel('Status').selectOption('INVESTIGATING')
  await expect(
    page.getByText('changed status from Open to Investigating'),
  ).toBeVisible()

  await page.getByLabel('Add a comment').fill('Rolled back the deploy.')
  await page.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(page.getByText('Rolled back the deploy.')).toBeVisible()

  await details.getByLabel('Status').selectOption('RESOLVED')
  await expect(
    page.getByText('changed status from Investigating to Resolved'),
  ).toBeVisible()
  await expect(details.getByLabel('Status')).toHaveValue('RESOLVED')

  // The default list shows active incidents only; filtering finds it.
  await page.getByRole('link', { name: 'Incidents', exact: true }).click()
  const item = page
    .getByRole('listitem')
    .filter({ hasText: 'Checkout returns 502' })
  await expect(page.getByText('No incidents match these filters.')).toBeVisible()
  await expect(item).toHaveCount(0)

  await page.getByLabel('Status').selectOption('RESOLVED')
  await expect(item).toContainText('Resolved')
  await expect(item).toContainText('High')
  await expect(page).toHaveURL(/status=RESOLVED/)
})
