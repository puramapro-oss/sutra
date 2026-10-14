// Authorized QA identity only. Run inside SUTRA; no token/link/body is emitted.
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import assert from 'node:assert/strict'

const report = { observedAt: new Date().toISOString(), checks: [], generationRequests: 0 }
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
  for (const path of ['/dashboard', '/create', '/production', '/settings/social', '/api/social/accounts', '/api/points', '/api/video/capabilities']) {
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
  report.pass = true
} catch {
  report.pass = false
  report.failedGate = gate
} finally {
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
