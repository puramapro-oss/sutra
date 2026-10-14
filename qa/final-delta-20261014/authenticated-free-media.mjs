// Authorized QA identity only. Run inside SUTRA; no token/link/body is emitted.
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'

const report = { observedAt: new Date().toISOString(), checks: [], generationRequests: 0 }
let fixturePath
let fixtureCreated = false
let sessionToken
let gate = 'configuration'
const cookies = new Map()
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'sutra' } })
try {
  const bindings = JSON.parse(process.env.ZERNIO_PROFILE_BINDINGS || '{}')
  assert.equal(Object.keys(bindings).length, 1)
  const uid = Object.keys(bindings)[0]
  gate = 'existing_authorized_identity'
  const current = await admin.auth.admin.getUserById(uid)
  assert.ifError(current.error)
  assert.equal(current.data.user.email?.toLowerCase(), 'matiss.frasne@gmail.com')
  assert.ok(current.data.user.email_confirmed_at)
  const profile = await admin.from('profiles').select('id,subscription_status,access_revoked_at').eq('id', uid).single()
  assert.ifError(profile.error)
  assert.equal(profile.data.id, uid)
  assert.notEqual(profile.data.subscription_status, 'banned')
  assert.equal(profile.data.access_revoked_at, null)
  gate = 'ephemeral_session'
  // generateLink does not send an email; identity existence was checked above.
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: current.data.user.email,
    options: { redirectTo: 'https://sutra.purama.dev/auth/callback' } })
  assert.ifError(link.error)
  assert.equal(link.data.user.id, uid)
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false }, cookies: {
      getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
      setAll: values => { for (const item of values) cookies.set(item.name, item.value) },
    } })
  const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'email' })
  // Retain token for cleanup before assertions that could fail.
  sessionToken = verified.data.session?.access_token
  assert.ifError(verified.error)
  assert.equal(verified.data.user.id, uid)
  assert.ok(sessionToken)
  assert.ok(cookies.size)
  report.identityVerified = true
  const cookie = Array.from(cookies, ([name, value]) => `${name}=${value}`).join('; ')
  for (const path of ['/library']) {
    gate = `get:${path}`
    const res = await fetch(`https://sutra.purama.dev${path}`, {
      headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(20000),
    })
    assert.equal(res.status, 200)
    const data = await res.text()
    assert.ok(data.length < 2_000_000)
    if (path === '/api/video/capabilities') {
      const json = JSON.parse(data)
      assert.equal(json.version, 1)
      assert.equal(json.personal.allowed, true)
      assert.equal(json.personal.state, 'disabled')
      assert.equal(json.personal.available, false)
      assert.equal(json.client.mode, 'api')
      assert.equal(json.client.reason, 'PROVIDER_NOT_PROBED')
    } else if (path === '/api/social/accounts') {
      const json = JSON.parse(data)
      assert.ok(Array.isArray(json.accounts))
      report.socialAccountCount = json.accounts.length
    } else if (path === '/api/points') {
      const json = JSON.parse(data)
      assert.equal(typeof json.points?.balance, 'number')
      assert.ok(Array.isArray(json.transactions))
    } else {
      assert.match(res.headers.get('content-type') || '', /text\/html/)
      assert.match(data, /<html/)
      assert.ok(!data.includes('NEXT_REDIRECT'))
    }
    report.checks.push({ path, http: res.status, contract: true })
  }
  // Schema rejects occur before job/quota/provider operations in these reviewed handlers.
  for (const path of ['/api/create', '/api/production', '/api/video/export']) {
    gate = `invalid-before-job:${path}`
    const rejected = await fetch(`https://sutra.purama.dev${path}`, {
      method: 'POST', headers: { cookie, 'Content-Type': 'application/json', Origin: 'https://sutra.purama.dev' },
      body: '{}', redirect: 'error', signal: AbortSignal.timeout(20000),
    })
    assert.equal(rejected.status, 400)
    await rejected.body?.cancel()
    report.checks.push({ path, http: rejected.status, contract: true, invalidPayload: true, providerCalls: 0 })
  }
  // Deterministic CPU text processing only. targetLang is deliberately absent.
  gate = 'subtitles_without_translation'
  const narration = 'Controle SUTRA gratuit. Aucun fournisseur appele.'
  const generated = await fetch('https://sutra.purama.dev/api/subtitles', {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json', Origin: 'https://sutra.purama.dev' },
    body: JSON.stringify({ narration, duration: 5, style: 'classic' }),
    redirect: 'error', signal: AbortSignal.timeout(20000),
  })
  assert.equal(generated.status, 200)
  const data = await generated.json()
  assert.ok(Array.isArray(data.subtitles) && data.subtitles.length > 0)
  assert.ok(data.subtitles.every(v => typeof v.text === 'string' && v.start >= 0 && v.end >= v.start && v.end <= 5))
  assert.ok(data.srt.includes(' --> ') && data.srt.includes('Controle SUTRA gratuit.'))
  report.checks.push({ path: '/api/subtitles', http: generated.status, contract: true, providerCalls: 0 })
  gate = 'subtitles_export'
  const exported = await fetch('https://sutra.purama.dev/api/subtitles/export', {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json', Origin: 'https://sutra.purama.dev' },
    body: JSON.stringify({ subtitles: data.subtitles }), redirect: 'error', signal: AbortSignal.timeout(20000),
  })
  assert.equal(exported.status, 200)
  assert.equal(exported.headers.get('content-disposition'), 'attachment; filename="subtitles.srt"')
  assert.equal(await exported.text(), data.srt)
  report.checks.push({ path: '/api/subtitles/export', http: exported.status, contract: true, exactContent: true, providerCalls: 0 })
  // One tiny owned synthetic fixture, never an existing user object.
  gate = 'private_storage_upload_fixture'
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1EAAAAASUVORK5CYII=', 'base64')
  fixturePath = `owners/${uid}/postdeploy/t01-${randomUUID()}.png`
  const uploaded = await admin.storage.from('sutra-assets').upload(fixturePath, image, { contentType: 'image/png', upsert: false })
  assert.ifError(uploaded.error)
  fixtureCreated = true
  gate = 'private_storage_owner_route'
  const path = '/api/media/' + Buffer.from(fixturePath).toString('base64url')
  const access = await fetch('https://sutra.purama.dev' + path, { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(20000) })
  assert.equal(access.status, 307)
  assert.equal(access.headers.get('cache-control'), 'private, no-store, max-age=0')
  const location = new URL(access.headers.get('location'))
  assert.equal(location.protocol, 'https:')
  assert.equal(location.origin, new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin)
  gate = 'private_storage_signed_bytes'
  const bytesResponse = await fetch(location, { redirect: 'error', signal: AbortSignal.timeout(20000) })
  assert.equal(bytesResponse.status, 200)
  const bytes = Buffer.from(await bytesResponse.arrayBuffer())
  assert.equal(bytes.length, image.length)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(image).digest('hex'))
  const ranged = await fetch(location, { headers: { Range: 'bytes=0-15' }, redirect: 'error', signal: AbortSignal.timeout(20000) })
  assert.equal(ranged.status, 206)
  assert.ok(Buffer.from(await ranged.arrayBuffer()).equals(image.subarray(0, 16)))
  gate = 'private_storage_access_denials'
  const anonymous = await fetch('https://sutra.purama.dev' + path, { redirect: 'manual', signal: AbortSignal.timeout(20000) })
  assert.equal(anonymous.status, 401)
  await anonymous.body?.cancel()
  const foreignPath = fixturePath.replace(`owners/${uid}/`, 'owners/00000000-0000-0000-0000-000000000000/')
  const foreign = await fetch('https://sutra.purama.dev/api/media/' + Buffer.from(foreignPath).toString('base64url'), { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(20000) })
  assert.equal(foreign.status, 404)
  await foreign.body?.cancel()
  report.checks.push({ path: '/api/media/[owned-fixture]', http: access.status, contract: true, exactBytes: true, sha256Matches: true, rangeStatus: ranged.status, anonymousStatus: anonymous.status, foreignOwnerStatus: foreign.status, providerCalls: 0 })
  report.pass = true
} catch {
  report.pass = false
  report.failedGate = gate
} finally {
  if (fixtureCreated) {
    const removed = await admin.storage.from('sutra-assets').remove([fixturePath])
    report.fixtureRemoved = !removed.error
    if (removed.error) report.pass = false
  } else report.fixtureRemoved = 'NO_FIXTURE_CREATED'
  if (sessionToken) {
    const revoked = await admin.auth.admin.signOut(sessionToken, 'local')
    report.testSessionRevoked = !revoked.error
    if (revoked.error) report.pass = false
  } else report.testSessionRevoked = 'NO_SESSION_CREATED'
  cookies.clear()
  sessionToken = undefined
}
process.stdout.write(JSON.stringify(report))
if (!report.pass) process.exitCode = 1
