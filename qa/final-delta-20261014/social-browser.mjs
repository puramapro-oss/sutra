import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'

export async function socialFeedbackChecks(page, base, output, check) {
    // The social page requires the authoritative config before exposing connect.
    // Other methods still reach the harness mutation-denial guard.
    await page.route('**/api/social/autopilot', route => route.request().method() === 'GET'
      ? route.fulfill({ json: { config: {
        enabled: false, default_platforms: [], auto_caption: true, auto_hashtags: true,
        caption_style: 'professional', max_hashtags: 5, include_cta: false,
      } } }) : route.fallback())
    for (const width of [375, 1440]) for (const [status, message] of [
      [409, 'Déconnexion en cours de vérification. Réessayez plus tard ; si le blocage persiste, contactez votre administrateur.'],
      [503, 'Profil social non attribué. Contactez votre administrateur.'],
    ]) await check(`${width}px social ${status}: safe actionable feedback without navigation`, async () => {
      await page.setViewportSize({ width, height: 900 })
      await page.route('**/api/social/connect', route => route.fulfill({ status, json: { error: 'UNTRUSTED_PROVIDER_DIAGNOSTIC' } }))
      await page.goto(base + '/settings/social')
      const button = page.getByRole('button', { name: 'Se connecter', exact: true }).first()
      await expect(button).toBeVisible()
      await button.click()
      const alert = page.getByTestId('social-connect-error')
      await expect(alert).toHaveAttribute('role', 'alert')
      await expect(alert).toHaveText(message)
      await expect(alert).toBeVisible()
      await expect(button).toBeEnabled()
      assert.equal(new URL(page.url()).pathname, '/settings/social')
      await expect(page.getByText('UNTRUSTED_PROVIDER_DIAGNOSTIC', { exact: true })).toHaveCount(0)
      await page.screenshot({ path: resolve(output, `social-${width}-${status}.png`), fullPage: false })
      await page.unroute('**/api/social/connect')
    })
    await page.unroute('**/api/social/autopilot')
}
