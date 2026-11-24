// Both public contact components execute unchanged. Their HTTP requests reach
// the actual route, schema and rate limiter; only the email provider is synthetic.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { chromium, webkit, expect } from '@playwright/test'
import { compileContactFixture } from './email-contact-fixture.mjs'
import { emailHarness } from './email-contact-harness.mjs'

const engines = (process.env.SUTRA_CONTACT_TEST_ENGINES || 'chromium,webkit').split(',')
assert.ok(engines.length > 0 && engines.every(engine => ['chromium', 'webkit'].includes(engine)))
assert.equal(new Set(engines).size, engines.length)
const browsers = new Map()
const scripts = new Map()
const errors = []
let server, base, active
const draft = {
  name: 'Camille', email: 'person@example.invalid',
  subject: 'Retrouver ma vidéo', message: 'Impossible de retrouver ma vidéo.',
}

before(async () => {
  for (const type of ['page', 'help']) scripts.set(type, await compileContactFixture(type))
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://fixture.invalid')
      if (url.pathname === '/fixture.js') {
        const script = scripts.get(url.searchParams.get('type'))
        if (!script) throw new Error('Unknown fixture')
        response.setHeader('Content-Type', 'text/javascript'); response.end(script); return
      }
      if (url.pathname === '/' && request.method === 'GET') {
        const type = url.searchParams.get('type')
        if (!scripts.has(type)) throw new Error('Unknown fixture')
        response.setHeader('Content-Type', 'text/html')
        response.end(`<!doctype html><html lang="fr"><body><main><div id="root"></div></main><script src="/fixture.js?type=${type}"></script></body></html>`)
        return
      }
      if (url.pathname === '/favicon.ico') { response.statusCode = 204; response.end(); return }
      if (request.url !== '/api/contact' || request.method !== 'POST') throw new Error(`Unexpected fixture route: ${request.method} ${request.url}`)
      const current = active
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const body = Buffer.concat(chunks).toString('utf8')
      current.requests.push(JSON.parse(body))
      const result = await current.POST(new Request(`${base}/api/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      }))
      response.statusCode = result.status
      response.setHeader('Content-Type', 'application/json')
      let text = await result.text()
      if (current.httpMode === 'missing-success') text = '{}'
      if (current.httpMode === 'false-success') text = '{"success":false}'
      if (current.httpMode === 'non-json') text = '<html>Unavailable</html>'
      response.end(text)
    } catch (error) {
      errors.push(error.message); response.statusCode = 500; response.end('{}')
    }
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}`
  for (const name of engines) {
    const engine = name === 'chromium' ? chromium : webkit
    const options = { headless: true }
    if (name === 'chromium' && process.env.SUTRA_CHROMIUM_PATH) options.executablePath = process.env.SUTRA_CHROMIUM_PATH
    browsers.set(name, await engine.launch(options))
  }
})
after(async () => {
  for (const browser of browsers.values()) await browser.close()
  if (server?.listening) await new Promise(resolve => server.close(resolve))
  assert.deepEqual(errors, [])
})

// Positional selection also permits the separate label test to expose the
// old unassociated textarea label instead of preventing all behavior checks.
function fields(page) {
  return { name: page.locator('input').nth(0), email: page.locator('input').nth(1),
    subject: page.locator('input').nth(2), message: page.locator('textarea') }
}
async function fill(page, value = draft) {
  for (const [name, input] of Object.entries(fields(page))) await input.fill(value[name])
}
async function open(engine, type, providerMode = 'ok', httpMode = 'ok') {
  const state = { providerMode, httpMode, hold: false, releases: [], requests: [] }
  state.harness = await emailHarness({ send: async () => {
    if (state.hold) await new Promise(resolve => state.releases.push(resolve))
    if (state.providerMode === 'error') return { data: null, error: { message: 'private-synthetic-diagnostic' } }
    if (state.providerMode === 'throw') throw new Error('private-synthetic-diagnostic')
    if (state.providerMode === 'missing-id') return { data: null, error: null }
    return { data: { id: 'fixture-provider-receipt' }, error: null }
  } })
  state.POST = (await state.harness.module('src/app/api/contact/route.ts')).POST
  active = state
  const page = await browsers.get(engine).newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(5000)
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === base) return route.continue()
    errors.push(`Unexpected external request: ${route.request().method()}`)
    return route.abort()
  })
  await page.goto(`${base}/?type=${type}`)
  await fill(page)
  return { page, state, async close() { for (const release of state.releases) release(); await page.close() } }
}
const submit = page => page.getByRole('button', { name: 'Envoyer', exact: true }).click()
const waitSuccess = page => expect(page.getByRole('status')).toContainText(/Message.*envoy/i)
const waitFailure = page => expect(page.getByRole('alert').first()).toBeVisible()
async function retained(page, expected = draft) {
  for (const [name, input] of Object.entries(fields(page))) assert.equal(await input.inputValue(), expected[name])
  await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toBeEnabled()
  assert.equal(await page.getByRole('status').count(), 0)
  assert.equal((await page.evaluate(() => window.contactFixture.toasts)).some(toast => toast.success), false)
  assert.ok(!(await page.locator('body').innerText()).includes('private-synthetic-diagnostic'))
  const linkedError = await page.locator('form').evaluate(form => {
    const id = form.getAttribute('aria-describedby')
    return Boolean(id && document.getElementById(id)?.getAttribute('role') === 'alert')
  })
  assert.equal(linkedError, true, 'The failure must be associated with the form')
}
async function injectValue(input, value) {
  await input.evaluate((element, next) => {
    const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, next)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}
const dispatchSubmit = page => page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

for (const engine of engines) for (const type of ['page', 'help']) {
  const prefix = `${engine}: ${type} contact`
  test(`${prefix} exposes associated labels and the published field limits`, async () => {
    const fixture = await open(engine, type)
    const { page } = fixture
    try {
      for (const label of [/^Nom/, /^Email/, /^Sujet/, /^Message/]) await expect(page.getByLabel(label)).toBeVisible()
      const controls = fields(page)
      for (const input of Object.values(controls)) assert.equal(await input.evaluate(element => element.required), true)
      for (const [name, length] of [['name', 100], ['subject', 200], ['message', 2000]]) assert.equal(await controls[name].evaluate(element => element.maxLength), length)
      for (const [name, length] of [['subject', 5], ['message', 10]]) assert.equal(await controls[name].evaluate(element => element.minLength), length)
    } finally { await fixture.close() }
  })

  test(`${prefix} trims its complete payload and delivers the name to the fixed recipient`, async () => {
    const fixture = await open(engine, type)
    const { page, state } = fixture
    try {
      await fill(page, Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, `  ${value}  `])))
      await submit(page); await waitSuccess(page)
      assert.deepEqual(state.requests, [draft])
      assert.equal(state.harness.state.sends.length, 1)
      const sent = state.harness.state.sends[0]
      assert.equal(sent.to, 'matiss.frasne@gmail.com')
      assert.equal(sent.replyTo, draft.email)
      assert.ok(sent.text.includes(draft.name))
      assert.ok(sent.text.endsWith(draft.message))
      assert.equal('html' in sent, false)
    } finally { await fixture.close() }
  })

  for (const [boundary, value] of [
    ['minimum', { ...draft, name: 'N', subject: 'Sujet', message: 'M'.repeat(10) }],
    ['maximum', { ...draft, name: 'N'.repeat(100), subject: 'S'.repeat(200), message: 'M'.repeat(2000) }],
  ]) test(`${prefix} accepts ${boundary} lengths without truncating a field`, async () => {
    const fixture = await open(engine, type)
    try {
      await fill(fixture.page, value); await submit(fixture.page); await waitSuccess(fixture.page)
      assert.deepEqual(fixture.state.requests, [value])
      assert.equal(fixture.state.harness.state.sends.length, 1)
    } finally { await fixture.close() }
  })

  for (const [field, invalid] of [
    ['name', ' '.repeat(5)], ['subject', ' '.repeat(5)], ['message', ' '.repeat(10)],
    ['subject', 'abcd'], ['message', 'M'.repeat(9)], ['email', 'invalid'],
    ['name', 'N'.repeat(101)], ['subject', 'S'.repeat(201)], ['message', 'M'.repeat(2001)],
  ]) test(`${prefix} rejects invalid ${field} length ${invalid.length} before HTTP even without native validation`, async () => {
    const fixture = await open(engine, type)
    const { page, state } = fixture
    try {
      await injectValue(fields(page)[field], invalid)
      await dispatchSubmit(page); await waitFailure(page)
      await retained(page, { ...draft, [field]: invalid })
      assert.equal(state.requests.length, 0)
      assert.equal(state.harness.state.sends.length, 0)
    } finally { await fixture.close() }
  })

  for (const httpMode of ['missing-success', 'false-success', 'non-json']) {
    test(`${prefix} refuses HTTP 200 with ${httpMode} and retains the draft`, async () => {
      const fixture = await open(engine, type, 'ok', httpMode)
      try {
        await submit(fixture.page); await waitFailure(fixture.page); await retained(fixture.page)
        assert.equal(fixture.state.requests.length, 1)
        assert.equal(fixture.state.harness.state.sends.length, 1)
      } finally { await fixture.close() }
    })
  }

  for (const providerMode of ['missing-id', 'error', 'throw']) {
    test(`${prefix} preserves ${providerMode} failures and supports an explicit retry`, async () => {
      const fixture = await open(engine, type, providerMode)
      const { page, state } = fixture
      try {
        await submit(page); await waitFailure(page); await retained(page)
        assert.equal(state.harness.state.sends.length, 1)
        state.providerMode = 'ok'
        await submit(page); await waitSuccess(page)
        assert.equal(state.harness.state.sends.length, 2)
        assert.deepEqual(state.requests, [draft, draft])
      } finally { await fixture.close() }
    })
  }

  test(`${prefix} admits one same-tick POST and freezes all submitted fields`, async () => {
    const fixture = await open(engine, type)
    const { page, state } = fixture
    state.hold = true
    try {
      await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit() })
      await expect.poll(() => state.harness.state.sends.length).toBe(1)
      await expect.poll(() => state.releases.length).toBe(1)
      for (const input of Object.values(fields(page))) await expect(input).toBeDisabled()
      await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true')
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
      state.releases[0](); await waitSuccess(page)
      assert.equal(state.requests.length, 1)
      assert.equal(state.harness.state.sends.length, 1)
    } finally { await fixture.close() }
  })

  test(`${prefix} keeps confirmation terminal until a deliberate new message`, async () => {
    const fixture = await open(engine, type)
    const { page, state } = fixture
    try {
      await page.locator('form').evaluate(form => { window.previousContactForm = form })
      await submit(page); await waitSuccess(page)
      assert.equal(await page.locator('form').count(), 0)
      await page.evaluate(() => {
        window.previousContactForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
        document.querySelector('form')?.requestSubmit()
      })
      assert.equal(state.requests.length, 1)
      if (type === 'help') {
        await page.getByRole('button', { name: /crire un autre message/i }).click()
        for (const input of Object.values(fields(page))) await expect(input).toHaveValue('')
        assert.equal(await page.getByRole('status').count(), 0)
        assert.equal(state.requests.length, 1)
        await fill(page, { ...draft, message: 'Une autre question indépendante.' })
        await submit(page); await waitSuccess(page)
        assert.equal(state.requests.length, 2)
      }
    } finally { await fixture.close() }
  })

  test(`${prefix} ignores a late confirmation after its submitting instance unmounts`, async () => {
    const fixture = await open(engine, type)
    const { page, state } = fixture
    state.hold = true
    try {
      await submit(page)
      await expect.poll(() => state.releases.length).toBe(1)
      await page.evaluate(() => { window.contactFixture.unmount(); window.contactFixture.mount() })
      await expect(page.locator('form')).toBeVisible()
      const response = page.waitForResponse(result => result.url() === `${base}/api/contact`)
      state.releases[0](); await (await response).finished()
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      // A new user edit proves the replacement instance remains interactive.
      await fields(page).name.fill('Nouveau brouillon')
      await expect(fields(page).name).toHaveValue('Nouveau brouillon')
      assert.equal(await page.getByRole('status').count(), 0)
      assert.equal((await page.evaluate(() => window.contactFixture.toasts)).length, 0)
      assert.equal(state.requests.length, 1)
      assert.equal(state.harness.state.sends.length, 1)
    } finally { await fixture.close() }
  })
}
