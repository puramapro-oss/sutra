// The actual help form submits over loopback HTTP to the actual contact handler,
// validator and rate limiter. Only the email provider is simulated. Separate
// corrupt-HTTP cases check that a 200 response alone never becomes UI success.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { chromium, webkit, expect } from '@playwright/test'
import { compileContactFixture } from './email-contact-fixture.mjs'
import { emailHarness } from './email-contact-harness.mjs'

let server, base, active
const browsers = new Map()
const errors = []
before(async () => {
  const script = await compileContactFixture()
  server = createServer(async (request, response) => {
    try {
      if (request.url === '/fixture.js') {
        response.setHeader('Content-Type', 'text/javascript'); response.end(script); return
      }
      if (request.url === '/' && request.method === 'GET') {
        response.setHeader('Content-Type', 'text/html')
        response.end('<!doctype html><html lang="fr"><body><div id="root"></div><script src="/fixture.js"></script></body></html>')
        return
      }
      if (request.url === '/favicon.ico') { response.statusCode = 204; response.end(); return }
      if (request.url !== '/api/contact' || request.method !== 'POST') {
        errors.push(`Unexpected fixture route: ${request.method} ${request.url}`)
        response.statusCode = 404; response.end(); return
      }
      const current = active
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const body = Buffer.concat(chunks).toString('utf8')
      current.requests.push({ path: request.url, body: JSON.parse(body) })
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
  for (const engine of [chromium, webkit]) browsers.set(engine.name(), await engine.launch({ headless: true }))
})
after(async () => {
  for (const browser of browsers.values()) await browser.close()
  if (server?.listening) await new Promise(resolve => server.close(resolve))
  assert.deepEqual(errors, [])
})

async function open(engine, providerMode = 'ok', httpMode = 'ok') {
  const state = { providerMode, httpMode, hold: false, release: null, requests: [] }
  state.harness = await emailHarness({ send: async () => {
    if (state.hold) await new Promise(resolve => { state.release = resolve })
    if (state.providerMode === 'error') return { data: null, error: { message: 'private-synthetic-diagnostic' } }
    if (state.providerMode === 'throw') throw new Error('private-synthetic-diagnostic')
    if (state.providerMode === 'missing-id') return { data: null, error: null }
    return { data: { id: 'fixture-provider-receipt' }, error: null }
  } })
  state.POST = (await state.harness.module('src/app/api/contact/route.ts')).POST
  active = state
  const page = await browsers.get(engine).newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  await page.goto(base)
  await page.getByRole('button', { name: 'Ecrire au support' }).click()
  await page.getByLabel('Ton prenom').fill('Camille')
  await page.getByLabel('Ton adresse email').fill('person@example.invalid')
  await page.getByLabel('Ton message au support').fill('Impossible de retrouver ma vidéo.')
  return { page, state }
}
const submit = page => page.getByRole('button', { name: 'Envoyer', exact: true }).click()
const waitFailure = page => page.waitForFunction(() => window.contactFixture.toasts.some(t => !t.success))
const waitSuccess = page => page.getByRole('status').filter({ hasText: 'Message transmis' }).waitFor()
async function retained(page) {
  assert.equal(await page.getByLabel('Ton prenom').inputValue(), 'Camille')
  assert.equal(await page.getByLabel('Ton adresse email').inputValue(), 'person@example.invalid')
  assert.equal(await page.getByLabel('Ton message au support').inputValue(), 'Impossible de retrouver ma vidéo.')
  assert.equal(await page.getByRole('button', { name: 'Envoyer', exact: true }).isEnabled(), true)
  assert.equal(await page.getByRole('status').count(), 0)
  const toasts = await page.evaluate(() => window.contactFixture.toasts)
  assert.equal(toasts.some(t => t.success), false)
  assert.ok(!JSON.stringify(toasts).includes('private-synthetic-diagnostic'))
}

for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: help form reaches the actual fixed-recipient contact handler with its exact payload`, async () => {
    const { page, state } = await open(engine)
    try {
      await submit(page); await waitSuccess(page)
      assert.deepEqual(state.requests, [{ path: '/api/contact', body: {
        email: 'person@example.invalid', subject: 'Demande d’aide SUTRA',
        message: 'Prénom : Camille\n\nImpossible de retrouver ma vidéo.',
      } }])
      assert.equal(state.harness.state.sends.length, 1)
      const sent = state.harness.state.sends[0]
      assert.equal(sent.to, 'matiss.frasne@gmail.com')
      assert.equal(sent.replyTo, 'person@example.invalid')
      assert.ok(sent.text.endsWith(state.requests[0].body.message))
      assert.equal('html' in sent, false)
    } finally { await page.close() }
  })

  for (const providerMode of ['missing-id', 'error', 'throw']) {
    test(`${engine}: ${providerMode} preserves all help fields and allows an explicit retry`, async () => {
      const { page, state } = await open(engine, providerMode)
      try {
        await submit(page); await waitFailure(page); await retained(page)
        assert.equal(state.harness.state.sends.length, 1)
        state.providerMode = 'ok'
        await submit(page); await waitSuccess(page)
        assert.equal(state.harness.state.sends.length, 2)
        assert.deepEqual(state.requests[0].body, state.requests[1].body)
      } finally { await page.close() }
    })
  }

  for (const httpMode of ['missing-success', 'false-success', 'non-json']) {
    test(`${engine}: an HTTP 200 with ${httpMode} cannot replace the help draft with success`, async () => {
      const { page, state } = await open(engine, 'ok', httpMode)
      try {
        await submit(page); await waitFailure(page); await retained(page)
        assert.equal(state.harness.state.sends.length, 1)
      } finally { await page.close() }
    })
  }

  test(`${engine}: same-tick submissions admit one send and freeze the submitted fields`, async () => {
    const { page, state } = await open(engine)
    state.hold = true
    try {
      await page.evaluate(() => {
        const form = document.querySelector('form')
        form.requestSubmit(); form.requestSubmit()
      })
      await expect.poll(() => state.harness.state.sends.length).toBe(1)
      await expect(page.getByLabel('Ton message au support')).toBeDisabled()
      assert.equal(await page.getByLabel('Ton prenom').isDisabled(), true)
      assert.equal(await page.getByLabel('Ton adresse email').isDisabled(), true)
      assert.equal(await page.getByRole('button', { name: 'Annuler' }).isDisabled(), true)
      state.release(); await waitSuccess(page)
      assert.equal(state.requests.length, 1)
      assert.equal(state.harness.state.sends.length, 1)
    } finally { state.release?.(); await page.close() }
  })

  test(`${engine}: invalid email is refused before sending and maximum visible inputs remain intact`, async () => {
    const { page, state } = await open(engine)
    try {
      await page.getByLabel('Ton adresse email').fill('invalid')
      await submit(page)
      assert.equal(await page.getByLabel('Ton adresse email').evaluate(input => input.validity.valid), false)
      assert.equal(state.harness.state.sends.length, 0)
      await page.getByLabel('Ton adresse email').fill('person@example.invalid')
      await page.getByLabel('Ton prenom').fill('N'.repeat(100))
      await page.getByLabel('Ton message au support').fill('M'.repeat(1800))
      await submit(page); await waitSuccess(page)
      assert.equal(state.requests[0].body.message, `Prénom : ${'N'.repeat(100)}\n\n${'M'.repeat(1800)}`)
      assert.equal(state.harness.state.sends.length, 1)
    } finally { await page.close() }
  })
}
