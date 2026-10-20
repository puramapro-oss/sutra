// Native selector boundary proof only; full application journeys remain CI gates.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium, webkit, expect as playwrightExpect } from '@playwright/test'
const sourcePath = 'qa/t07-frontend-journey-20261014/journey-checks.mjs'
const source = await readFile(sourcePath, 'utf8')
const start = source.indexOf("      const alert = page.getByTestId('social-connect-error')")
assert.ok(start >= 0)
const end = source.indexOf('      await expect(button).toBeEnabled()', start)
assert.ok(end > start)
const boundary = source.slice(start, end)
const validate = new (Object.getPrototypeOf(async () => {}).constructor)('page', 'expect', boundary)
const expect = playwrightExpect.configure({ timeout: 150 })
const message = 'Profil social non attribué. Contactez votre administrateur.'
const results = []
for (const [engine, type] of Object.entries({ chromium, webkit })) {
  const browser = await type.launch({ headless: true, ...(engine === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {}) })
  try {
    for (const width of [375, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      await page.route('**/*', route => route.abort())
      const render = (alert) => page.setContent(`${alert}<div data-title>${message}</div>`)
      await render(`<p role="alert" data-testid="social-connect-error">${message}</p>`)
      await assert.rejects(() => expect(page.getByText(message, { exact: true })).toBeVisible(), /strict mode violation/)
      await validate(page, expect)
      results.push({ engine, width, case: 'duplicate toast and persistent alert', status: 'PASS', before: 'strict mode violation', after: 'persistent alert verified' })
      for (const [name, html] of [
        ['missing alert', ''],
        ['wrong role', `<p role="status" data-testid="social-connect-error">${message}</p>`],
        ['wrong message', '<p role="alert" data-testid="social-connect-error">wrong message</p>'],
        ['hidden alert', `<p hidden role="alert" data-testid="social-connect-error">${message}</p>`],
      ]) {
        await render(html)
        await assert.rejects(() => validate(page, expect))
        results.push({ engine, width, case: name, status: 'PASS', invalidStateRejected: true })
      }
      await page.close()
    }
  } finally { await browser.close() }
}
const receipt = { sourcePath, sourceSha256: createHash('sha256').update(source).digest('hex'), scope: 'Native HTML selector boundary only; not application E2E', pass: results.length, fail: 0, skip: 0, results }
await writeFile(new URL('./native-results.json', import.meta.url), JSON.stringify(receipt, null, 2) + '\n')
process.stdout.write(JSON.stringify({ pass: receipt.pass, fail: 0, skip: 0, sourceSha256: receipt.sourceSha256 }) + '\n')
