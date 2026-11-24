import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'

export async function storageChecks({ page, base, fixture, output, check }) {
  const key = `sutra:production-intent:v1:${fixture.user.id}`
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await check(`${width}: unreadable receipt shows unknown status and visible error, with generation blocked`, async () => {
      await page.goto(base + '/production')
      await expect(page.getByTestId('production-idea')).toBeEnabled()
      await page.evaluate(key => sessionStorage.setItem(key, '{invalid fixture'), key)
      await page.reload()
      const panel = page.getByTestId('production-request-status')
      await expect(panel.getByRole('alert')).toContainText('Reçu local indisponible.')
      await expect(panel.getByRole('status')).toHaveText('État de la demande non confirmé.')
      await expect(page.getByTestId('generate-all')).toBeDisabled()
      await expect(page.getByTestId('production-idea')).toBeDisabled()
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), '{invalid fixture')
      await expect(panel.locator('..')).toHaveCSS('opacity', '1')
      await page.screenshot({ path: resolve(output, `receipt-unknown-${width}.png`), fullPage: true })
      await page.evaluate(key => sessionStorage.removeItem(key), key)
      await page.reload()
      await expect(panel.getByRole('status')).toHaveText('Aucune demande en cours dans cet onglet.')
      await expect(page.getByTestId('production-idea')).toBeEnabled()
    })
  }
}
