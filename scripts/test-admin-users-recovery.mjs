// Real AdminUsersPage and hook in Chromium; synthetic read-only local API.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

let browser, server, base
const errors = []
before(async () => {
  const compiled = await build({
    stdin: { resolveDir: process.cwd(), loader: 'js', contents: `
      import { createElement, StrictMode } from 'react';
      import { createRoot } from 'react-dom/client';
      import AdminUsersPage from './src/app/(dashboard)/admin/users/page.tsx';
      window.adminFixture = { calls: [], recover: false, holdCreator: false, release: null };
      window.fetch = async (url, init = {}) => {
        const plan = new URL(url, location.origin).searchParams.get('plan') || 'all';
        const call = { plan, aborted: false }; window.adminFixture.calls.push(call);
        init.signal?.addEventListener('abort', () => { call.aborted = true; }, { once: true });
        const response = () => {
          if (plan === 'creator' && !window.adminFixture.recover) return new Response('{}', { status: 500 });
          const user = { id: plan + '-user', email: plan + '@example.invalid', name: plan,
            plan: plan === 'all' ? 'free' : plan, is_admin: false, credits: 1, wallet_balance: 0,
            monthly_video_count: 0, subscription_status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
          return new Response(JSON.stringify({ users: [user], total: 1, page: 1, limit: 20, total_pages: 1 }), { status: 200 });
        };
        return plan === 'creator' && window.adminFixture.holdCreator
          ? new Promise(resolve => { window.adminFixture.release = () => resolve(response()); }) : response();
      };
      createRoot(document.getElementById('root')).render(createElement(StrictMode, null, createElement(AdminUsersPage)));
    ` },
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' }, tsconfig: 'tsconfig.json',
  })
  server = createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(compiled.outputFiles[0].contents); return }
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html><body><div id="root"></div><script src="/fixture.js"></script></body></html>')
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.SUTRA_CHROMIUM_PATH ? { executablePath: process.env.SUTRA_CHROMIUM_PATH } : {}) })
})
after(async () => { await browser?.close(); server?.close(); assert.deepEqual(errors, []) })

async function open() {
  const page = await browser.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  await page.goto(base)
  await expect(page.getByTestId('admin-user-row-all-user')).toBeVisible()
  return page
}

test('failed filter B after success A removes stale users and CSV export; retry shows only B', async () => {
  const page = await open()
  try {
    await expect(page.getByTestId('admin-users-export')).toBeEnabled()
    await page.getByTestId('admin-users-filter-plan').selectOption('creator')
    await expect(page.getByTestId('admin-users-retry')).toBeVisible({ timeout: 1500 })
    await expect(page.getByTestId('admin-user-row-all-user')).toHaveCount(0)
    await expect(page.getByTestId('admin-users-export')).toHaveCount(0)
    await page.evaluate(() => { window.adminFixture.recover = true })
    await page.getByTestId('admin-users-retry').click()
    await expect(page.getByTestId('admin-user-row-creator-user')).toBeVisible()
    await expect(page.getByTestId('admin-user-row-all-user')).toHaveCount(0)
    await expect(page.getByTestId('admin-users-export')).toBeEnabled()
  } finally { await page.close() }
})

test('an aborted former filter cannot clear or replace the current users after its late failure', async () => {
  const page = await open()
  try {
    await page.evaluate(() => { window.adminFixture.holdCreator = true })
    await page.getByTestId('admin-users-filter-plan').selectOption('creator')
    await page.waitForFunction(() => Boolean(window.adminFixture.release))
    await page.getByTestId('admin-users-filter-plan').selectOption('empire')
    await expect(page.getByTestId('admin-user-row-empire-user')).toBeVisible()
    assert.equal(await page.evaluate(() => window.adminFixture.calls.find(call => call.plan === 'creator').aborted), true)
    await page.evaluate(() => window.adminFixture.release())
    await page.waitForTimeout(30)
    await expect(page.getByTestId('admin-user-row-empire-user')).toBeVisible()
    await expect(page.getByTestId('admin-users-export')).toBeEnabled()
    await expect(page.getByTestId('admin-users-retry')).toHaveCount(0)
  } finally { await page.close() }
})
