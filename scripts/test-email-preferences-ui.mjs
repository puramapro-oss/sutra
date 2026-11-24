// Actual notification settings page and React hook, in an isolated browser.
// Database responses are simulated; no email or external request is permitted.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { chromium } from '@playwright/test'
import { compilePreferencesFixture } from './email-preferences-fixture.mjs'

let server, browser, base
const errors = []
before(async () => {
  const script = await compilePreferencesFixture()
  server = createServer((request, response) => {
    if (request.url === '/fixture.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(script); return
    }
    response.setHeader('Content-Type', 'text/html')
    response.end('<!doctype html><html lang="fr"><body><div id="root"></div><script src="/fixture.js"></script></body></html>')
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); server?.close(); assert.deepEqual(errors, []) })
async function open() {
  const page = await browser.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  await page.goto(base)
  await page.getByTestId('settings-save-notifications').waitFor()
  return page
}
const save = page => page.getByTestId('settings-save-notifications').click()
const other = '22222222-2222-4222-8222-222222222222'

test('page uses stored choices and confirms the exact saved result', async () => {
  const page = await open()
  try {
    assert.equal(await page.getByTestId('toggle-notif-tips').getAttribute('aria-checked'), 'false')
    await page.getByTestId('toggle-notif-tips').click(); await save(page)
    await page.getByRole('status').filter({ hasText: 'enregistrées' }).waitFor()
    const result = await page.evaluate(() => ({ writes: window.prefs.writes, refetches: window.prefs.refetches }))
    assert.equal(result.writes.length, 1); assert.equal(result.writes[0].values.email_preferences.tips, true)
    assert.equal(result.refetches, 1)
    await page.evaluate(() => window.prefs.refetch())
    await page.getByRole('status').filter({ hasText: 'enregistrées' }).waitFor()
    await page.getByTestId('toggle-notif-tips').click()
    assert.equal(await page.getByRole('status').count(), 0)
  } finally { await page.close() }
})

test('identity recheck failure is visible and the same choices can be retried', async () => {
  const page = await open()
  try {
    await page.getByTestId('toggle-notif-tips').click()
    await page.evaluate(() => { window.prefs.authFailureAt = 2 })
    await save(page); await page.getByRole('alert').filter({ hasText: 'confirmée' }).waitFor()
    assert.equal(await page.getByTestId('toggle-notif-tips').getAttribute('aria-checked'), 'true')
    assert.equal(await page.evaluate(() => window.prefs.toasts.some(value => value.success)), false)
    await save(page)
    await page.getByRole('status').filter({ hasText: 'enregistrées' }).waitFor()
    const writes = await page.evaluate(() => window.prefs.writes)
    assert.equal(writes.length, 2); assert.deepEqual(writes[0].values, writes[1].values)
  } finally { await page.close() }
})

test('a failed profile refresh preserves the confirmed save receipt', async () => {
  const page = await open()
  try {
    await page.getByTestId('toggle-notif-tips').click()
    await page.evaluate(() => { window.prefs.refetchFails = true })
    await save(page)
    await page.getByRole('status').filter({ hasText: 'enregistrées' }).waitFor()
    assert.match(await page.getByRole('status').textContent(), /actualisé/)
    assert.equal(await page.getByTestId('toggle-notif-tips').getAttribute('aria-checked'), 'true')
    assert.equal(await page.evaluate(() => window.prefs.writes.length), 1)
    assert.equal(await page.getByRole('alert').count(), 0)
  } finally { await page.close() }
})

for (const mode of ['error', 'empty']) {
  test(`page preserves edits and offers retry after ${mode} receipt`, async () => {
    const page = await open()
    try {
      await page.getByTestId('toggle-notif-tips').click()
      await page.evaluate(value => { window.prefs.response = value }, mode)
      await save(page); await page.getByRole('alert').filter({ hasText: 'confirmée' }).waitFor()
      assert.equal(await page.getByTestId('toggle-notif-tips').getAttribute('aria-checked'), 'true')
      assert.equal(await page.getByTestId('settings-save-notifications').isEnabled(), true)
      assert.equal(await page.evaluate(() => window.prefs.toasts.some(value => value.success)), false)
      await page.evaluate(() => { window.prefs.response = 'ok' }); await save(page)
      await page.getByRole('status').filter({ hasText: 'enregistrées' }).waitFor()
      const writes = await page.evaluate(() => window.prefs.writes)
      assert.equal(writes.length, 2); assert.deepEqual(writes[0].values, writes[1].values)
    } finally { await page.close() }
  })
}

test('same-turn double clicks admit one save and freeze controls while pending', async () => {
  const page = await open()
  try {
    await page.evaluate(() => {
      window.prefs.hold = true
      const button = document.querySelector('[data-testid="settings-save-notifications"]')
      button.click(); button.click()
    })
    await page.waitForFunction(() => window.prefs.writes.length === 1)
    assert.equal(await page.getByTestId('toggle-notif-welcome').isDisabled(), true)
    await page.evaluate(() => window.prefs.releases.forEach(release => release()))
    await page.getByRole('status').filter({ hasText: 'enregistrées' }).waitFor()
    assert.equal(await page.evaluate(() => window.prefs.writes.length), 1)
  } finally { await page.close() }
})

test('switching account aborts an old save and never presents its receipt', async () => {
  const page = await open()
  try {
    await page.evaluate(() => { window.prefs.hold = true }); await save(page)
    await page.waitForFunction(() => window.prefs.writes.length === 1)
    await page.evaluate(owner => window.prefs.switchOwner(owner), other)
    await page.waitForFunction(() => window.prefs.writes[0].aborted)
    assert.equal(await page.getByTestId('toggle-notif-welcome').getAttribute('aria-checked'), 'false')
    await page.evaluate(() => window.prefs.releases.forEach(release => release()))
    await page.waitForTimeout(30)
    assert.equal(await page.getByRole('status').count(), 0)
    assert.equal(await page.evaluate(() => window.prefs.toasts.length), 0)
    assert.equal(await page.getByTestId('settings-save-notifications').isEnabled(), true)
  } finally { await page.close() }
})

test('leaving the page aborts observation and ignores a late receipt', async () => {
  const page = await open()
  try {
    await page.evaluate(() => { window.prefs.hold = true }); await save(page)
    await page.waitForFunction(() => window.prefs.writes.length === 1)
    await page.evaluate(() => window.prefs.unmount())
    assert.equal(await page.evaluate(() => window.prefs.writes[0].aborted), true)
    await page.evaluate(() => window.prefs.releases.forEach(release => release()))
    await page.waitForTimeout(30)
    assert.equal(await page.evaluate(() => window.prefs.toasts.length), 0)
  } finally { await page.close() }
})

test('missing identity disables saving and never leaks the former preferences', async () => {
  const page = await open()
  try {
    await page.evaluate(() => window.prefs.switchOwner(null))
    await page.getByRole('alert').filter({ hasText: 'profil' }).waitFor()
    assert.equal(await page.getByTestId('settings-save-notifications').isDisabled(), true)
    for (const key of ['welcome', 'digest', 'inactivity', 'tips', 'contest', 'referral']) {
      assert.equal(await page.getByTestId(`toggle-notif-${key}`).getAttribute('aria-checked'), 'false')
    }
    assert.equal(await page.evaluate(() => window.prefs.writes.length), 0)
  } finally { await page.close() }
})
