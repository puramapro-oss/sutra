import { webkit, expect } from '@playwright/test'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
const root = 'qa/t07-final-ux-perf-20261015'
const { base } = JSON.parse(await readFile(`${root}/production-chromium/owned-server.json`, 'utf8'))
const output = `${root}/keyboard-webkit-regression`
await mkdir(output, { recursive: true })
const browser = await webkit.launch({ headless: true })
const context = await browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: 'reduce' })
const results = [], errors = []
await context.route('**/*', route => {
  const req = route.request(), url = new URL(req.url())
  if (url.origin !== base) return route.abort()
  if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { success: true } })
  return ['GET', 'HEAD'].includes(req.method()) ? route.continue() : route.abort()
})
const page = await context.newPage()
page.on('pageerror', e => errors.push(e.message))
try {
  for (const path of ['signup', 'login']) for (const width of [375, 1440]) {
    try {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${base}/${path}`)
      if (path === 'signup' && width === 375) await page.getByTestId('cookie-refuse').click()
      await page.getByTestId('password-input').focus()
      await page.keyboard.press('Alt+Tab') // macOS WebKit full keyboard navigation, proven on native HTML control.
      await expect(page.getByRole('button', { name: 'Afficher le mot de passe' })).toBeFocused()
      await page.keyboard.press('Space')
      await expect(page.getByTestId('password-input')).toHaveAttribute('type', 'text')
      await expect(page.getByRole('button', { name: 'Masquer le mot de passe' })).toHaveAttribute('aria-pressed', 'true')
      await page.waitForTimeout(700)
      await page.screenshot({ path: `${output}/${path}-${width}.png`, fullPage: true })
      results.push({ name: `${path} ${width}: password visibility reachable by keyboard`, status: 'PASS' })
    } catch (e) { results.push({ name: `${path} ${width}: password visibility reachable by keyboard`, status: 'FAIL', message: e.message }); process.exitCode = 1 }
  }
} finally {
  await browser.close()
  await writeFile(`${output}/results.json`, JSON.stringify({ base, keyboard: 'Alt+Tab', results, errors }, null, 2) + '\n')
  process.stdout.write(JSON.stringify(results) + '\n')
}
