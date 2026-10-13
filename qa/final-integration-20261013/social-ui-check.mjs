import { chromium, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const log = readFileSync('test-results/t08/browser/server.log', 'utf8')
const base = log.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1]
if (!base) throw new Error('Local fixture server not found')
const browser = await chromium.launch({ headless: true })
const checks = []
try {
  for (const width of [375, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    await ctx.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
      if (url.origin === base && url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ accounts: [], should_show: false, notifications: [], data: [] }) })
      return route.continue()
    })
    await ctx.addInitScript(() => {
      localStorage.setItem('purama_cookie_consent_v1', JSON.stringify({ necessaire: true, mesure: false, marketing: false, updatedAt: new Date().toISOString() }))
      localStorage.setItem('sutra_intro_seen', '1'); localStorage.setItem('sutra_tutorial_dismissed', 'true')
    })
    const page = await ctx.newPage()
    await page.goto(base + '/login')
    await page.getByTestId('email-input').fill('studio-test@example.invalid')
    await page.getByTestId('password-input').fill('fixture-password-42')
    await page.getByTestId('login-button').click()
    await page.waitForURL('**/dashboard')
    await page.goto(base + '/settings/social')
    for (const platform of ['tiktok', 'youtube', 'instagram', 'facebook', 'x', 'linkedin', 'pinterest', 'reddit', 'threads']) {
      await expect(page.getByTestId('connect-' + platform)).toBeEnabled()
      checks.push({ width, platform, status: 'PASS', enabled: true })
    }
    for (const platform of ['snapchat', 'tumblr', 'mastodon', 'bluesky', 'vimeo']) {
      await expect(page.getByTestId('connect-' + platform)).toBeDisabled()
      await expect(page.getByTestId('connect-' + platform)).toHaveText('Connexion indisponible')
      checks.push({ width, platform, status: 'PASS', enabled: false })
    }
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid^=platform-card-]')].length === 14 && [...document.querySelectorAll('[data-testid^=platform-card-]')].every(el => Number(getComputedStyle(el).opacity) === 1))
    await page.waitForTimeout(750)
    await page.screenshot({ path: 'qa/final-integration-20261013/social-' + width + '.png', fullPage: true })
    await ctx.close()
  }
} finally { await browser.close() }
writeFileSync('qa/final-integration-20261013/social-ui-check.json', JSON.stringify({ checks, fixtureOnly: true, providerRequests: 0 }, null, 2) + '\n')
process.stdout.write('PASS social UI: ' + checks.length + ' checks; fixture only; no connection initiated\n')
