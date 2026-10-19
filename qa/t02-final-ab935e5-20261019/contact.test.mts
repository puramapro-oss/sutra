import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
let messages: Record<string, string>[] = []
let providerThrows = false
let providerRefuses = false
let now = Date.now()
mock.module('resend', { namedExports: { Resend: class {
  emails = { send: async (payload: Record<string, string>) => {
    messages.push(payload)
    if (providerThrows) throw new Error('SYNTHETIC_PRIVATE_MAIL_DIAGNOSTIC')
    return { error: providerRefuses ? { message: 'SYNTHETIC_PRIVATE_MAIL_DIAGNOSTIC' } : null }
  } }
} } })
const { POST } = await import('../../src/app/api/contact/route.ts')
const request = (message = 'Contact message valid', email = 'sender@example.test') => new Request('https://sutra.example.test/api/contact', {
  method: 'POST', body: JSON.stringify({ email, subject: '<b>Subject injected</b>', message }),
  headers: { 'content-type': 'application/json', 'x-forwarded-for': email },
})
beforeEach(() => {
  messages = []; providerThrows = providerRefuses = false
  now += 120_000
  mock.method(Date, 'now', () => now)
})
test('contact preserves legitimate message as text without attacker-controlled HTML', async () => {
  const response = await POST(request('<a href="https://evil.example.test">Change account password</a>'))
  assert.equal(response.status, 200); assert.equal(messages.length, 1)
  assert.equal(messages[0].html, undefined)
  assert.match(messages[0].text, /Change account password/)
})
test('contact never exposes thrown provider diagnostics', async () => {
  providerThrows = true
  const response = await POST(request())
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), /SYNTHETIC_PRIVATE_MAIL_DIAGNOSTIC/)
})
test('contact does not report success for a provider refusal', async () => {
  providerRefuses = true
  const response = await POST(request())
  assert.equal(response.status, 502)
  assert.doesNotMatch(await response.text(), /SYNTHETIC_PRIVATE_MAIL_DIAGNOSTIC/)
})
test('contact repeated anonymous calls have a process cap that forged identity cannot bypass', async () => {
  let denied = 0
  for (let index = 0; index < 25; index++) {
    const response = await POST(request('Repeated valid message', `sender${index}@example.test`))
    if (response.status === 429) {
      denied++
      assert.ok(Number(response.headers.get('retry-after')) > 0)
    } else { assert.equal(response.status, 200) }
  }
  assert.ok(denied > 0, 'Repeated anonymous sends must be capped')
  assert.equal(messages.length, 25 - denied)
})
test('contact rejects malformed inputs before sending mail', async () => {
  assert.equal((await POST(request('x'))).status, 400)
  assert.equal(messages.length, 0)
})
