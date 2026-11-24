// Anonymous public screens only: fresh contexts, no mutation or provider calls.
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const source = process.argv[2]
assert.match(source ?? '', /^[a-f0-9]{40}$/)
const deployment = JSON.parse(await readFile(new URL('../t01-final-20261015/deployment.json', import.meta.url)))
assert.equal(deployment.status, 'PASS')
assert.equal(deployment.source, source)
const origin = 'https://sutra.purama.dev'
const report = { source, observedAt: new Date().toISOString(), scope: 'Anonymous desktop/mobile landing and login only', checks: [], status: 'PASS' }
const browser = await chromium.launch({ headless: true })
try {
  for (const width of [375, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
    let unexpectedMutations = 0
    const errors = []
    await context.route('**/*', async route => {
      const req = route.request()
      if (!['GET', 'HEAD'].includes(req.method())) { unexpectedMutations++; return route.abort() }
      if (new URL(req.url()).origin !== origin) return route.abort()
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', () => errors.push('PAGE_ERROR'))
    for (const path of ['/', '/login']) {
      const response = await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 30000 })
      const visible = await page.locator('body').innerText()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      const name = `${path === '/' ? 'landing' : 'login'}-${width}.png`
      await page.screenshot({ path: new URL(name, import.meta.url).pathname, fullPage: true })
      const check = { path, width, http: response?.status(), visibleText: visible.length > 100, overflow, pageErrors: errors.length, unexpectedMutations, screenshot: name }
      check.pass = check.http === 200 && check.visibleText && !overflow && !check.pageErrors && !unexpectedMutations
      report.checks.push(check)
      if (!check.pass) report.status = 'FAIL'
    }
    await context.close()
  }
} finally { await browser.close() }
await writeFile(new URL('public-browser.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(JSON.stringify(report) + '\n')
if (report.status !== 'PASS') process.exitCode = 1
