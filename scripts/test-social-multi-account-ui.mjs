import assert from 'node:assert/strict'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

// Real UI components, isolated React host, simulated API only. No provider/account access.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const id = number => `11111111-1111-4111-8111-${String(number).padStart(12, '0')}`
const externalId = number => String(number).padStart(24, '0')
const account = (number, platform = 'youtube') => ({ id: id(number), platform, external_id: externalId(number),
  username: `chaine_${number}`, display_name: `Chaîne ${number}`, status: 'connected', token_expires_at: null })
const A = account(1), B = account(2), I = account(3, 'instagram'), C = account(4)
const baseSocial = { enabled: true, default_platforms: ['youtube'], publish_account_ids: [A.id],
  auto_caption: true, auto_hashtags: true, caption_style: 'engaging', max_hashtags: 10, include_cta: true }
const baseAuto = { default_style: 'cinematic', default_duration: 15, default_aspect_ratio: '9:16',
  default_music_genre: 'ambient', default_voice_enabled: false, default_voice_id: null, default_language: 'fr',
  publish_platforms: ['youtube'], publish_account_ids: [A.id], auto_publish: true,
  require_approval_before_publish: true, preferred_model: 'ltx-2-3-fast', quality_level: 'standard' }
const fixture = { accounts: [A, B, I], social: { ...baseSocial }, auto: { ...baseAuto }, accountsError: false }
const requests = { publish: [], connect: [], revoke: [], social: [], auto: [] }
let publishResponse = () => ({ results: [] })
let rejectPublication = false
const failures = [], blockedExternal = [], checks = []

const bundle = await build({
  absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import SocialSettings from './src/app/(dashboard)/settings/social/page';
    import AutoSettings from './src/app/(dashboard)/auto/settings/page';
    import { PublishEverywhereButton } from './src/components/social/PublishEverywhereButton';
    import { normalizePublicationResults } from './src/components/social/publish/publication-results';
    window.normalizePublicationResults = normalizePublicationResults;
    const view = location.pathname === '/settings/social' ? <SocialSettings />
      : location.pathname === '/auto/settings' ? <AutoSettings />
      : <PublishEverywhereButton videoId="${id(90)}" videoTitle="Vidéo multicomptes" defaultPlatforms={['youtube']} />;
    createRoot(document.getElementById('root')).render(view);
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env': '{}' }, logLevel: 'silent',
  plugins: [{ name: 'isolated-navigation-and-auth', setup(builder) {
    builder.onResolve({ filter: /^(next\/(link|navigation)|@\/hooks\/useAuth)$/ }, args => ({ path: args.path, namespace: 'ui-fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'ui-fixture' }, args => ({ loader: 'tsx', resolveDir: root,
      contents: args.path === 'next/link'
        ? `import React from 'react'; export default function Link({href,prefetch,replace,scroll,...props}) { return <a href={href} {...props}/> }`
        : args.path === 'next/navigation'
          ? `export function useSearchParams() { return new URLSearchParams(location.search) }`
          : `export function useAuth() { return {loading:false,profile:{id:'${id(99)}'}} }`,
    }))
  } }],
})
const javascript = bundle.outputFiles[0].text
const server = http.createServer((req, res) => {
  if (req.url === '/app.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(javascript); return }
  if (req.url?.startsWith('/api/')) { res.writeHead(500); res.end('UNMOCKED_API'); return }
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Test UI multicomptes</title><style>body{font-family:sans-serif}button{margin:4px;min-height:32px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>')
})
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
const origin = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.SUTRA_UI_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { blockedExternal.push(request.url()); await route.abort('blockedbyclient'); return }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
    const method = request.method(), body = request.postDataJSON()
    const reply = (data, status = 200) => route.fulfill({ status, json: data })
    if (url.pathname === '/api/social/accounts' && method === 'GET') return reply({ accounts: fixture.accounts }, fixture.accountsError ? 503 : 200)
    if (url.pathname === '/api/social/accounts' && method === 'DELETE') {
      requests.revoke.push(body)
      fixture.accounts = fixture.accounts.map(item => item.id === body.accountId ? { ...item, status: 'revoked' } : item)
      return reply({ success: true, remoteStatus: 'revoked' })
    }
    if (url.pathname === '/api/social/connect') { requests.connect.push(body); return reply({ error: 'Fixture : no real OAuth' }, 503) }
    if (url.pathname === '/api/social/autopilot') {
      if (method === 'POST') { requests.social.push(body); fixture.social = { ...fixture.social, ...body } }
      return reply({ config: fixture.social })
    }
    if (url.pathname === '/api/auto/config') {
      if (method === 'PATCH') { requests.auto.push(body); fixture.auto = { ...fixture.auto, ...body } }
      return reply({ config: fixture.auto })
    }
    if (url.pathname === '/api/social/publish') {
      requests.publish.push(body)
      if (rejectPublication) return route.abort('failed')
      return reply(publishResponse(body, requests.publish.length))
    }
    failures.push(`Unexpected API: ${method} ${url.pathname}`)
    return reply({ error: 'UNEXPECTED_API' }, 500)
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(error.message))
  const openPublish = async () => {
    await page.goto(`${origin}/publish-test`)
    await page.getByTestId(`publish-everywhere-${id(90)}`).click()
    await expect(page.getByTestId(`publish-account-${A.id}`)).toBeVisible()
  }
  const selectTwo = async () => {
    await page.getByTestId(`publish-account-${A.id}`).click()
    await page.getByTestId(`publish-account-${B.id}`).click()
  }
  const result = (item, status) => ({ platform: item.platform, localAccountId: item.id, accountId: item.external_id, status,
    success: status === 'published', ...(status === 'published' ? { postUrl: `https://example.invalid/post/${item.id}` } : {}) })

  // A legacy platform default never selects two identities implicitly.
  await openPublish()
  await expect(page.getByTestId(`publish-account-${A.id}`)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId(`publish-account-${B.id}`)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  await selectTwo()
  await page.getByTestId(`publish-account-${A.id}`).click()
  await expect(page.getByTestId(`publish-account-${B.id}`)).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId(`publish-account-${A.id}`).click()
  await page.getByTestId('caption-mode-custom').click()
  await page.getByTestId('custom-caption-input').fill('Légende conservée : deux chaînes, deux destinations.')
  await page.getByTestId('auto-hashtags-toggle').uncheck()
  publishResponse = (_body, count) => ({ results: count === 1 ? [result(A, 'published'),
    { platform: B.platform, accountId: B.external_id, status: 'failed', success: false }] : [result(B, 'published')] })
  await page.getByTestId('publish-submit').evaluate(button => { button.click(); button.click() })
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('Publie')
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('Echec')
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('@chaine_1')
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('@chaine_2')
  assert.equal(requests.publish.length, 1, 'One immediate double activation must make one POST')
  assert.deepEqual(requests.publish[0].platforms, ['youtube'])
  assert.deepEqual(requests.publish[0].destinations, [{ platform: 'youtube', accountId: A.id }, { platform: 'youtube', accountId: B.id }])
  assert.equal(Object.hasOwn(requests.publish[0], 'accountIds'), false)
  assert.deepEqual(requests.publish[0].hashtags, [])
  await expect(page.getByTestId('custom-caption-input')).toBeDisabled()
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('Publie')
  assert.deepEqual(requests.publish[1].destinations, [{ platform: 'youtube', accountId: B.id }])
  assert.equal(requests.publish[1].caption, requests.publish[0].caption)
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('Publie')
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  checks.push('Independent same-platform selection, exact payload, duplicate-click guard, partial retry, immutable caption')

  // A genuinely lost response leaves each destination unknown and cannot be retried.
  await openPublish(); await selectTwo()
  rejectPublication = true
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('A verifier')
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('A verifier')
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  rejectPublication = false
  checks.push('Lost response remains unknown per account, without a retry')

  // Unknown A does not prevent a confirmed failed B from being retried; A stays untouched.
  await openPublish(); await selectTwo()
  publishResponse = body => ({ results: body.destinations.length === 2 ? [result(A, 'unknown'), result(B, 'failed')] : [result(B, 'published')] })
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId('publish-submit')).toHaveText('Reprendre les échecs (1)')
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('Publie')
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('A verifier')
  assert.deepEqual(requests.publish.at(-1).destinations, [{ platform: 'youtube', accountId: B.id }])
  checks.push('Retry preserves an uncertain sibling account')

  const normalized = await page.evaluate(({ a, b }) => {
    const valid = { platform: a.platform, localAccountId: a.id, accountId: a.external_id, status: 'published', success: true }
    return [
      window.normalizePublicationResults([{ ...valid, success: false }], [a]),
      window.normalizePublicationResults([{ ...valid, status: 'failed' }], [a]),
      window.normalizePublicationResults([valid, valid], [a]),
      window.normalizePublicationResults([{ ...valid, accountId: b.external_id }], [a]),
      window.normalizePublicationResults([{ platform: 'youtube', status: 'published', success: true }], [a, b]),
      window.normalizePublicationResults([valid], [a, b]),
    ]
  }, { a: A, b: B })
  for (const list of normalized.slice(0, 5)) for (const item of list) { assert.equal(item.status, 'unknown'); assert.equal(item.success, false) }
  assert.equal(normalized[5][0].status, 'published'); assert.equal(normalized[5][1].status, 'unknown')
  checks.push('Contradictory, duplicate, mismatched and absent result identities fail closed')

  await page.goto(`${origin}/settings/social`)
  await expect(page.getByTestId('connected-count')).toHaveText('3 comptes connectés')
  await expect(page.getByTestId(`social-account-${A.id}`)).toBeVisible()
  await expect(page.getByTestId(`social-account-${B.id}`)).toBeVisible()
  await expect(page.getByTestId(`autopilot-account-${A.id}`)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId(`autopilot-account-${B.id}`)).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId(`autopilot-account-${B.id}`).click()
  await page.getByTestId('save-autopilot').click()
  await expect.poll(() => requests.social.length).toBe(1)
  assert.deepEqual(requests.social[0].publish_account_ids, [A.id, B.id])
  assert.deepEqual(requests.social[0].default_platforms, ['youtube'])
  fixture.accounts = [...fixture.accounts, C]
  await page.reload()
  await expect(page.getByTestId(`autopilot-account-${C.id}`)).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId('connect-youtube').click()
  await expect(page.getByTestId('social-connect-error')).toBeVisible()
  assert.deepEqual(requests.connect.at(-1), { platform: 'youtube' })
  await page.getByTestId(`reconnect-${B.id}`).click()
  await expect.poll(() => requests.connect.length).toBe(2)
  assert.deepEqual(requests.connect.at(-1), { platform: 'youtube', accountId: B.id })
  await page.getByTestId(`disconnect-${A.id}`).click()
  await expect(page.getByRole('dialog')).toContainText('Chaîne 1')
  await page.getByTestId('confirm-disconnect').click()
  await expect(page.getByTestId(`social-account-${A.id}`)).toContainText('Déconnecté')
  await expect(page.getByTestId(`social-account-${B.id}`)).toContainText('Connecté')
  assert.deepEqual(requests.revoke, [{ accountId: A.id }])
  await expect(page.getByTestId('save-autopilot')).toBeDisabled()
  await page.getByTestId(`autopilot-account-remove-${A.id}`).click()
  await expect(page.getByTestId('save-autopilot')).toBeEnabled()
  checks.push('Social settings list all accounts, bind add/reconnect/revoke, and keep autopilot account consent explicit')

  fixture.accounts = [A, B, I, C]
  await page.goto(`${origin}/auto/settings`)
  await expect(page.getByTestId(`auto-publish-account-${A.id}`)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId(`auto-publish-account-${B.id}`)).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId(`auto-publish-account-${C.id}`)).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId(`auto-publish-account-${B.id}`).click()
  await page.getByTestId('settings-save').click()
  await expect.poll(() => requests.auto.length).toBe(1)
  assert.deepEqual(requests.auto[0].publish_account_ids, [A.id, B.id])
  assert.deepEqual(requests.auto[0].publish_platforms, ['youtube'])
  assert.equal(requests.auto[0].require_approval_before_publish, true)
  assert.equal(Object.hasOwn(requests.auto[0], 'schedules'), false)
  fixture.auto = { ...fixture.auto, publish_account_ids: [] }
  await page.reload()
  await expect(page.getByTestId('settings-save')).toBeDisabled()
  await page.getByTestId('auto-publish-toggle').uncheck()
  await expect(page.getByTestId('settings-save')).toBeEnabled()
  checks.push('Automatic video settings save explicit accounts and preserve approval/schedule boundaries')

  fixture.accountsError = true
  await page.goto(`${origin}/auto/settings`)
  await expect(page.getByTestId('auto-settings-load-error')).toBeVisible()
  await expect(page.getByTestId('settings-save')).toHaveCount(0)
  await page.goto(`${origin}/settings/social`)
  await expect(page.getByTestId('social-load-error')).toBeVisible()
  await expect(page.getByTestId('save-autopilot')).toHaveCount(0)
  fixture.accountsError = false
  checks.push('Failed account reads cannot replace saved settings or enable save')

  fixture.accounts = Array.from({ length: 51 }, (_, index) => account(index + 1))
  await openPublish()
  await expect(page.getByTestId('publish-toggle-all')).toBeDisabled()
  for (const item of fixture.accounts.slice(0, 50)) await page.getByTestId(`publish-account-${item.id}`).click()
  await expect(page.getByTestId(`publish-account-${fixture.accounts[50].id}`)).toBeDisabled()
  await expect(page.getByTestId('publish-submit')).toContainText('50 comptes')
  await page.getByTestId('publish-toggle-all').click()
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  checks.push('50-account limit, no silent truncation, and explicit clear-all')

  assert.deepEqual(failures, [])
  assert.deepEqual(blockedExternal, [])
  console.log(JSON.stringify({ status: 'PASS', browserVersion: browser.version(), checks, outboundRequests: blockedExternal.length,
    fixtureRequests: Object.fromEntries(Object.entries(requests).map(([key, value]) => [key, value.length])) }, null, 2))
} finally {
  await browser?.close()
  await new Promise(resolveClose => server.close(resolveClose))
}
