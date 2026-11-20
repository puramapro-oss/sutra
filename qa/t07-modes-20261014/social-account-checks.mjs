import { expect } from '@playwright/test'

export async function assertSocialAccountRows(page, accounts, connectedAccount) {
  await expect(page.getByTestId('connected-count')).toHaveText('1 compte connecté')
  await expect(page.getByText('Sur 1 / 14 réseaux', { exact: true })).toBeVisible()
  await expect(page.getByTestId(`disconnect-${connectedAccount.id}`)).toBeVisible()
  for (const account of accounts.filter(account => account.id !== connectedAccount.id)) {
    const { platform } = account
    const card = page.getByTestId(`platform-card-${platform}`)
    const row = card.getByTestId(`social-account-${account.id}`)
    await expect(row).toContainText(`Compte fixture · @historique_${platform}`)
    await expect(row.getByTestId(`reconnect-${account.id}`)).toBeEnabled()
    await expect(card.getByTestId(`connect-${platform}`)).toBeEnabled()
    await expect(row.getByText(account.status === 'revoked' ? 'Déconnecté' : 'Connexion à renouveler', { exact: true })).toBeVisible()
    if (account.status === 'revoked') await expect(row.getByTestId(`disconnect-${account.id}`)).toHaveCount(0)
    else await expect(row.getByTestId(`disconnect-${account.id}`)).toBeEnabled()
    await expect(row.getByText('Connecté', { exact: true })).toHaveCount(0)
    await expect(card.getByText('1 connecté', { exact: true })).toHaveCount(0)
  }
}

export async function assertAutopilotAccountChoices(page, accounts, connectedAccount) {
  await page.getByTestId('toggle-autopilot').click()
  await expect(page.getByTestId(`autopilot-account-${connectedAccount.id}`)).toBeVisible()
  await expect(page.getByTestId(`autopilot-account-${connectedAccount.id}`)).toHaveAttribute('aria-pressed', 'false')
  for (const account of accounts.filter(account => account.id !== connectedAccount.id)) {
    await expect(page.getByTestId(`autopilot-account-${account.id}`)).toHaveCount(0)
  }
  await page.getByTestId('toggle-autopilot').click()
}
