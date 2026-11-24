import test from 'node:test'
import assert from 'node:assert/strict'
import { emailHarness, jsonRequest } from './email-contact-harness.mjs'

const contactBody = { email: 'person@example.invalid', subject: 'Demande d’aide SUTRA', message: 'Prénom : Camille\n\nImpossible de retrouver ma vidéo.' }

for (const [template, data] of [
  ['payment-confirmation', { name: 'Synthetic caller', amount: '999999' }],
  ['support-reply', { message: '<a href="https://attacker.invalid">Synthetic arbitrary HTML</a>' }],
]) {
  test(`an ordinary authenticated account cannot relay ${template} to an arbitrary recipient`, async () => {
    const f = await emailHarness()
    const { POST } = await f.module('src/app/api/email/route.ts')
    const response = await POST(jsonRequest('/api/email', { to: 'unrelated@example.invalid', subject: 'Synthetic subject', template, data }))
    assert.equal(response.status, 410)
    assert.deepEqual(await response.json(), { error: 'Cette voie d’envoi d’email n’est plus disponible.', code: 'EMAIL_ROUTE_DISABLED' })
    assert.equal(f.state.sends.length, 0)
    assert.equal(f.state.constructors, 0)
    assert.equal(f.state.authReads, 0)
  })
}

test('the closed route imports without provider configuration and never reads the body or identity', async () => {
  const f = await emailHarness({ env: { RESEND_API_KEY: undefined }, user: null })
  const { POST } = await f.module('src/app/api/email/route.ts')
  const response = await POST({ json() { assert.fail('Closed route must not parse caller data') } })
  assert.equal(response.status, 410)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(f.state.constructors, 0)
  assert.equal(f.state.authReads, 0)
})

test('the existing subscription contract retains recipient and centimes without inventing a monthly period', async () => {
  const f = await emailHarness()
  const { sendSubscriptionEmail } = await f.module('src/lib/emails.ts')
  assert.equal(await sendSubscriptionEmail('payer@example.invalid', 'starter', 8600), undefined)
  assert.equal(f.state.sends.length, 1)
  const sent = f.state.sends[0]
  assert.equal(sent.from, 'SUTRA by Purama <noreply@purama.dev>')
  assert.equal(sent.to, 'payer@example.invalid')
  assert.equal(sent.subject, 'Abonnement starter active !')
  assert.match(sent.html, /Montant : 86\.00 EUR/)
  assert.doesNotMatch(sent.html, /EUR\/mois/)
})

test('transactional HTML escapes caller text and keeps video identifiers inside one query parameter', async () => {
  const f = await emailHarness({ env: { NEXT_PUBLIC_APP_URL: 'https://sutra.example/' } })
  const mail = await f.module('src/lib/emails.ts')
  const payload = '<img src=x onerror="boom">&\'quoted\''
  const videoId = 'x" onclick="boom&other=1#fragment'
  await mail.sendWelcomeEmail('person@example.invalid', payload)
  await mail.sendSubscriptionEmail('person@example.invalid', payload, 100)
  await mail.sendVideoReadyEmail('person@example.invalid', payload, videoId)
  for (const sent of f.state.sends) {
    assert.doesNotMatch(sent.html, /<img/)
    assert.match(sent.html, /&lt;img src=x onerror=&quot;boom&quot;&gt;&amp;&#39;quoted&#39;/)
  }
  const href = f.state.sends[2].html.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&')
  const url = new URL(href)
  assert.equal(url.origin, 'https://sutra.example')
  assert.equal(url.pathname, '/library')
  assert.deepEqual([...url.searchParams], [['video', videoId]])
  assert.equal(url.hash, '')
})

test('dynamic subjects are plain text without line breaks', async () => {
  const f = await emailHarness()
  const mail = await f.module('src/lib/emails.ts')
  await mail.sendVideoReadyEmail('person@example.invalid', 'Title\r\nBcc: synthetic@example.invalid', 'video')
  assert.doesNotMatch(f.state.sends[0].subject, /[\r\n]/)
})

for (const origin of ['javascript:alert(1)', 'https://user:password@example.invalid', 'https://sutra.example/extra', 'https://sutra.example/?x=1']) {
  test(`invalid public email origin is rejected before any provider call: ${origin}`, async () => {
    const f = await emailHarness({ env: { NEXT_PUBLIC_APP_URL: origin } })
    const mail = await f.module('src/lib/emails.ts')
    await assert.rejects(mail.sendWelcomeEmail('person@example.invalid', 'Camille'), /Invalid public application origin/)
    assert.equal(f.state.sends.length, 0)
    assert.equal(f.state.constructors, 0)
  })
}

for (const id of [undefined, null, '', '   ', 42, {}]) {
  test(`transactional and contact sends reject an invalid provider receipt: ${JSON.stringify(id)}`, async () => {
    const f = await emailHarness({ send: async () => ({ data: { id }, error: null }) })
    const mail = await f.module('src/lib/emails.ts')
    await assert.rejects(mail.sendSubscriptionEmail('payer@example.invalid', 'starter', 900), /Email non envoye/)
    const contact = await f.module('src/app/api/contact/route.ts')
    const response = await contact.POST(jsonRequest('/api/contact', contactBody))
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: 'Erreur envoi message' })
  })
}

for (const mode of ['api-error', 'transport-error']) {
  test(`provider ${mode} remains an error without exposing provider diagnostics`, async () => {
    const marker = 'private-synthetic-provider-diagnostic'
    const f = await emailHarness({ send: async () => {
      if (mode === 'transport-error') throw new Error(marker)
      return { data: { id: 'stale-receipt' }, error: { name: marker, message: marker } }
    } })
    const mail = await f.module('src/lib/emails.ts')
    await assert.rejects(mail.sendSubscriptionEmail('payer@example.invalid', 'starter', 900), error => {
      assert.match(error.message, /Email non envoye/)
      assert.ok(!error.message.includes(marker))
      return true
    })
    assert.ok(!JSON.stringify(f.state.logs).includes(marker))
    const contact = await f.module('src/app/api/contact/route.ts')
    const response = await contact.POST(jsonRequest('/api/contact', contactBody))
    assert.ok(response.status >= 500)
    assert.ok(!(await response.text()).includes(marker))
  })
}

test('contact accepts the help payload only for the fixed support recipient and a real provider receipt', async () => {
  const f = await emailHarness()
  const { POST } = await f.module('src/app/api/contact/route.ts')
  const response = await POST(jsonRequest('/api/contact', {
    ...contactBody, to: 'unrelated@example.invalid', from: 'attacker@example.invalid', html: '<b>ignored</b>',
  }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true })
  assert.equal(f.state.sends.length, 1)
  const sent = f.state.sends[0]
  assert.equal(sent.to, 'matiss.frasne@gmail.com')
  assert.equal(sent.from, 'SUTRA Contact <noreply@purama.dev>')
  assert.equal(sent.replyTo, contactBody.email)
  assert.equal(sent.subject, `[SUTRA Contact] ${contactBody.subject}`)
  assert.ok(sent.text.endsWith(contactBody.message))
  assert.equal('html' in sent, false)
})

test('contact preserves the submitted name and trims visible fields before provider admission', async () => {
  const f = await emailHarness()
  const { POST } = await f.module('src/app/api/contact/route.ts')
  const response = await POST(jsonRequest('/api/contact', {
    name: '  Camille  ', email: '  person@example.invalid  ',
    subject: '  Demande d’aide SUTRA  ', message: '  Impossible de retrouver ma vidéo.  ',
  }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true })
  assert.equal(f.state.sends.length, 1)
  assert.deepEqual(f.state.sends[0], {
    from: 'SUTRA Contact <noreply@purama.dev>', to: 'matiss.frasne@gmail.com',
    replyTo: 'person@example.invalid', subject: '[SUTRA Contact] Demande d’aide SUTRA',
    text: 'Nouveau message de contact SUTRA\nNom : Camille\nDe : person@example.invalid\nSujet : Demande d’aide SUTRA\n\nImpossible de retrouver ma vidéo.',
  })
})

test('the existing escalation payload keeps its embedded name without a second name field', async () => {
  const f = await emailHarness()
  const { POST } = await f.module('src/app/api/contact/route.ts')
  const response = await POST(jsonRequest('/api/contact', contactBody))
  assert.equal(response.status, 200)
  assert.equal(f.state.sends.length, 1)
  assert.equal(f.state.sends[0].text,
    `Nouveau message de contact SUTRA\nDe : ${contactBody.email}\nSujet : ${contactBody.subject}\n\n${contactBody.message}`)
})

for (const name of [null, 42, {}, '', '   ', 'n'.repeat(101)]) {
  test(`invalid supplied contact name is rejected before any provider call: ${JSON.stringify(name)}`, async () => {
    const f = await emailHarness()
    const { POST } = await f.module('src/app/api/contact/route.ts')
    const response = await POST(jsonRequest('/api/contact', { ...contactBody, name }))
    assert.equal(response.status, 400)
    assert.equal(f.state.constructors, 0)
    assert.equal(f.state.sends.length, 0)
  })
}

for (const [field, value] of [
  ['subject', '    x    '], ['subject', 's'.repeat(201)],
  ['message', '             '], ['message', 'm'.repeat(2001)],
]) {
  test(`contact ${field} bounds apply to meaningful trimmed content: ${value.length} characters`, async () => {
    const f = await emailHarness()
    const { POST } = await f.module('src/app/api/contact/route.ts')
    const response = await POST(jsonRequest('/api/contact', { ...contactBody, [field]: value }))
    assert.equal(response.status, 400)
    assert.equal(f.state.constructors, 0)
    assert.equal(f.state.sends.length, 0)
  })
}

test('contact accepts the exact normalized field limits without truncating user content', async () => {
  const f = await emailHarness()
  const { POST } = await f.module('src/app/api/contact/route.ts')
  const name = 'N'.repeat(100)
  const subject = 'S'.repeat(200)
  const message = 'M'.repeat(2000)
  const response = await POST(jsonRequest('/api/contact', {
    name: ` ${name} `, subject: ` ${subject} `, message: ` ${message} `,
    email: contactBody.email,
  }))
  assert.equal(response.status, 200)
  assert.equal(f.state.sends.length, 1)
  assert.equal(f.state.sends[0].subject, `[SUTRA Contact] ${subject}`)
  assert.ok(f.state.sends[0].text.includes(`\nNom : ${name}\n`))
  assert.ok(f.state.sends[0].text.endsWith(`\n\n${message}`))
})

test('contact still validates its existing contract and limits provider admission across forged identities', async () => {
  const invalid = await emailHarness()
  const invalidRoute = await invalid.module('src/app/api/contact/route.ts')
  assert.equal((await invalidRoute.POST(jsonRequest('/api/contact', { name: 'Camille', email: contactBody.email, message: contactBody.message }))).status, 400)
  assert.equal(invalid.state.sends.length, 0)
  const f = await emailHarness()
  const { POST } = await f.module('src/app/api/contact/route.ts')
  for (let i = 0; i < 20; i++) {
    const response = await POST(jsonRequest('/api/contact', { ...contactBody, email: `person${i}@example.invalid` }, { 'x-forwarded-for': `192.0.2.${i}` }))
    assert.equal(response.status, 200)
  }
  const response = await POST(jsonRequest('/api/contact', contactBody, { 'x-forwarded-for': '198.51.100.1' }))
  assert.equal(response.status, 429)
  assert.ok(Number(response.headers.get('retry-after')) > 0)
  assert.equal(f.state.sends.length, 20)
})

test('imports remain independent of email configuration and contact reports unavailability without sending', async () => {
  const f = await emailHarness({ env: { RESEND_API_KEY: undefined } })
  const mail = await f.module('src/lib/emails.ts')
  assert.equal(f.state.constructors, 0)
  await assert.rejects(mail.sendSubscriptionEmail('payer@example.invalid', 'starter', 900), /Configuration manquante/)
  const { POST } = await f.module('src/app/api/contact/route.ts')
  assert.equal(f.state.constructors, 0)
  const response = await POST(jsonRequest('/api/contact', contactBody))
  assert.equal(response.status, 503)
  assert.equal(f.state.sends.length, 0)
})
