import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export async function assertStoredMarkupInert({ page, base, id, payload }) {
  // Background prefetches are not readiness signals for these security checks.
  // Keep bounded navigation/assertion deadlines and require the exact persisted UI.
  assert.equal((await page.goto(base + '/library', { waitUntil: 'domcontentloaded' }))?.status(), 200)
  await expect(page.getByTestId(`video-card-${id}`)).toBeVisible()
  await expect(page.getByTestId(`video-card-${id}`)).toContainText(payload)
  assert.equal(await page.evaluate(() => window.__t08Xss), 0)
  assert.equal((await page.goto(base + '/editor/' + id, { waitUntil: 'domcontentloaded' }))?.status(), 200)
  await expect(page).toHaveURL(base + '/editor/' + id)
  await expect(page.getByTestId('editor-title')).toHaveText(payload)
  await expect(page.locator('main img[onerror]')).toHaveCount(0)
  assert.equal(await page.evaluate(() => window.__t08Xss), 0)
  await expect(page.getByTestId('editor-export')).toBeEnabled()
}
