import { expect, test } from '@playwright/test'
import { fillRegisterForm, signUpWithOrganization, uniqueEmail } from './helpers.ts'

test('invite someone without an account, who signs up and joins', async ({
  page,
  browser,
}) => {
  await signUpWithOrganization(page, 'Olivia', 'Acme Support')

  await page.getByRole('link', { name: 'Members', exact: true }).click()

  const inviteeEmail = uniqueEmail('maya')
  await page.getByLabel('Email', { exact: true }).fill(inviteeEmail)
  await page.getByLabel('Role', { exact: true }).selectOption('MEMBER')
  await page.getByRole('button', { name: 'Invite' }).click()

  await expect(page.getByRole('status')).toContainText(
    `Invitation for ${inviteeEmail} created.`,
  )
  const link = await page.getByLabel('Invitation link').inputValue()
  await expect(page.getByRole('cell', { name: inviteeEmail, exact: true })).toBeVisible()

  // The invitee opens the link in their own browser, logged out.
  const inviteeContext = await browser.newContext()
  const invitee = await inviteeContext.newPage()

  await invitee.goto(link)
  await expect(
    invitee.getByRole('heading', { name: 'Join Acme Support' }),
  ).toBeVisible()
  await expect(
    invitee.getByText(`Olivia Test invited ${inviteeEmail}`),
  ).toBeVisible()

  await invitee.getByRole('link', { name: 'Create account' }).click()
  await fillRegisterForm(invitee, 'Maya', inviteeEmail)

  // Signing up returns to the invitation.
  await invitee.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(
    invitee.getByRole('heading', { level: 1, name: 'Acme Support' }),
  ).toBeVisible()

  await invitee.getByRole('link', { name: 'Members', exact: true }).click()
  await expect(invitee.getByRole('cell', { name: /^Maya Test/ })).toBeVisible()
  await expect(invitee.getByRole('heading', { name: 'Invite people' })).toHaveCount(0)

  // The link only works once.
  await invitee.goto(link)
  await expect(
    invitee.getByText('This invitation has already been accepted.'),
  ).toBeVisible()

  await inviteeContext.close()

  // The owner sees the new member, and the invitation is no longer pending.
  await page.reload()
  await expect(page.getByRole('cell', { name: /^Maya Test/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pending invitations' })).toHaveCount(0)
})
