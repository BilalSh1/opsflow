import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'correct-horse-battery'

// Every run signs up new users, so tests never collide with earlier data.
export function uniqueEmail(name: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return `${name.toLowerCase()}-${suffix}@example.com`
}

// Fills the register form on the current page and waits until the user is
// signed in and has left it.
export async function fillRegisterForm(
  page: Page,
  firstName: string,
  email: string,
): Promise<void> {
  await page.getByLabel('First name').fill(firstName)
  await page.getByLabel('Last name').fill('Test')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).not.toHaveURL(/\/register$/)
}

// Signs up a new user and creates their first organization.
export async function signUpWithOrganization(
  page: Page,
  firstName: string,
  organizationName: string,
): Promise<{ email: string }> {
  const email = uniqueEmail(firstName)

  await page.goto('/register')
  await fillRegisterForm(page, firstName, email)

  await expect(
    page.getByRole('heading', { name: 'Create your first organization' }),
  ).toBeVisible()
  await page.getByLabel('Organization name').fill(organizationName)
  await page.getByRole('button', { name: 'Create organization' }).click()

  await expect(
    page.getByRole('heading', { level: 1, name: organizationName }),
  ).toBeVisible()

  return { email }
}
