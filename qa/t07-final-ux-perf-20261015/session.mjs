import { expect } from '@playwright/test'

export async function enterTestSession({ page, base, fixture }) {
  await page.goto(base + '/login?next=/library')
  await page.getByTestId('cookie-refuse').click()
  await page.getByTestId('email-input').fill(fixture.user.email)
  await page.getByTestId('password-input').fill('fixture-password')
  await page.getByTestId('login-button').click()
  const accept = page.getByRole('button', { name: "J'ai lu, je continue" })
  await expect(accept).toBeVisible({ timeout: 60000 })
  for (const doc of ['mentions', 'cgu', 'cgv', 'confidentialite']) {
    await accept.click()
    await expect.poll(() => fixture.state.acceptances.some(a => a.doc_type === doc)).toBe(true)
    if (doc !== 'confidentialite') await expect(accept).toBeEnabled()
  }
  await expect(accept).toHaveCount(0)
  await expect(page).toHaveURL(base + '/library')
  await expect(page.getByTestId('library-create-btn')).toBeVisible()
}
