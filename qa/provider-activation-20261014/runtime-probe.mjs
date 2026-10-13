// GET-only, runtime credentials; stdout contains only selected non-secret facts.
const out = { observedAt: new Date().toISOString(), generationRequests: 0 }
const safeGet = async (url, headers) => {
  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(18000) })
  const text = await response.text()
  if (text.length > 1048576) throw Error('BODY_LIMIT')
  let body
  try { body = JSON.parse(text) } catch { body = null }
  return { status: response.status, body }
}
const endpoint = process.env.RUNPOD_ENDPOINT_ID
if (!/^[A-Za-z0-9_-]{6,100}$/.test(endpoint ?? '')) throw Error('ENDPOINT_FORMAT')
const runpod = await safeGet(`https://api.runpod.ai/v2/${endpoint}/health`, { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` })
const counters = value => value && typeof value === 'object' && !Array.isArray(value)
  && Object.values(value).every(n => Number.isInteger(n) && n >= 0)
out.runpod = { http: runpod.status, contract: counters(runpod.body?.jobs) && counters(runpod.body?.workers),
  workers: Object.fromEntries(['idle', 'initializing', 'ready', 'running', 'throttled', 'unhealthy'].filter(k => Number.isInteger(runpod.body?.workers?.[k])).map(k => [k, runpod.body.workers[k]])),
  permission: 'endpoint GET health only; no submission tested', workerModelContract: 'NOT_TESTED' }
out.shotstack = {}
for (const [stage, key] of [['stage', 'SHOTSTACK_API_KEY'], ['v1', 'SHOTSTACK_PRODUCTION_KEY']]) {
  const r = await safeGet(`https://api.shotstack.io/edit/${stage}/templates`, { 'x-api-key': process.env[key] })
  out.shotstack[stage] = { http: r.status, contract: r.body?.success === true && Array.isArray(r.body?.response?.templates),
    templateCount: Array.isArray(r.body?.response?.templates) ? r.body.response.templates.length : null }
}
out.shotstack.selectedEnvironment = process.env.SHOTSTACK_ENV?.trim() || 'stage'
const z = await safeGet('https://zernio.com/api/v1/profiles', { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` })
const bindings = JSON.parse(process.env.ZERNIO_PROFILE_BINDINGS || '{}')
const matches = Array.isArray(z.body?.profiles) ? z.body.profiles.filter(p => Object.values(bindings).includes(p._id) && /^[a-f0-9]{24}$/.test(p._id)) : []
const team = await safeGet('https://zernio.com/api/v1/users', { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` })
const owners = Array.isArray(team.body?.users) ? team.body.users.filter(u => u._id === team.body.currentUserId && u.role === 'owner') : []
out.zernio = { http: z.status, uniqueBoundProfile: matches.length === 1,
  ownerHttp: team.status, ownershipVerified: owners.length === 1 && matches.length === 1 && matches[0].userId === owners[0]._id,
  bindingCount: Object.keys(bindings).length, puramaBindingCount: matches.length === 1 ? Object.values(bindings).filter(id => id === matches[0]._id).length : 0 }
if (matches.length === 1) {
  const a = await safeGet(`https://zernio.com/api/v1/accounts?profileId=${matches[0]._id}`, { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` })
  out.zernio.accountsHttp = a.status
  out.zernio.accountCount = Array.isArray(a.body?.accounts) ? a.body.accounts.length : null
  out.zernio.accountsScoped = Array.isArray(a.body?.accounts) && a.body.accounts.every(v => (typeof v.profileId === 'string' ? v.profileId : v.profileId?._id) === matches[0]._id)
}
out.localEngine = { enabled: process.env.LOCAL_ENGINE_ENABLED === 'true', urlPresent: Boolean(process.env.LOCAL_VIDEO_API_URL), health: 'NOT_CONFIGURED' }
if (out.localEngine.enabled && out.localEngine.urlPresent) {
  const u = new URL(process.env.LOCAL_VIDEO_API_URL)
  out.localEngine.loopback = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) throw Error('LOCAL_URL_FORMAT')
  u.pathname = `${u.pathname.replace(/\/$/, '')}/health`
  try { const r = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(3000) }); out.localEngine.health = r.status; await r.body?.cancel() }
  catch { out.localEngine.health = 'UNREACHABLE' }
}
out.pass = out.runpod.http === 200 && out.runpod.contract && ['stage', 'v1'].every(k => out.shotstack[k].http === 200 && out.shotstack[k].contract)
  && out.zernio.http === 200 && out.zernio.uniqueBoundProfile && out.zernio.ownershipVerified && out.zernio.puramaBindingCount === 1 && out.zernio.accountsHttp === 200 && out.zernio.accountsScoped
process.stdout.write(JSON.stringify(out))
