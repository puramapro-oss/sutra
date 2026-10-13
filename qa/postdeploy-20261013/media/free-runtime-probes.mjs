/* eslint-disable no-console -- CLI proof emits only status assertions. */
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { get } from 'node:https'

export const deployedSha = '3e5596ea287f36427f687d3f3882d35c3f7c407b'
const origin = 'https://sutra.purama.dev'
const ref = path => Buffer.from(path).toString('base64url')

function publicGet(url) {
  // Force HTTP/1.1: this host's Node 26 default HTTP/2 transport failed with
  // NGHTTP2_PROTOCOL_ERROR before returning a response during the first probe.
  return new Promise((resolve, reject) => {
    get(url, { ALPNProtocols: ['http/1.1'], timeout: 20000 }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, headers: new Headers(response.headers), arrayBuffer: async () => Buffer.concat(chunks) }))
      response.on('error', reject)
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('Public probe timeout')) })
  })
}

function result(name, actual, expected, extra = {}) {
  return { name, status: actual === expected ? 'PASS' : 'FAIL', actual, expected, ...extra }
}

export async function publicMediaChecks() {
  const cases = [
    ['noncanonical-base64', 'YWJj='],
    ['dot-segment', ref('owners/postdeploy/../private.mp4')],
    ['empty-segment', ref('owners//postdeploy.mp4')],
    ['backslash', ref('owners/postdeploy\\private.mp4')],
    ['forged-publication-grant', ref('owners/postdeploy/free.mp4') + '?grant=synthetic.invalid'],
    ['oversized-publication-grant', ref('owners/postdeploy/free.mp4') + '?grant=' + 'x'.repeat(2050)],
  ]
  const checks = []
  for (const [name, reference] of cases) {
    const response = await publicGet(origin + '/api/media/' + reference)
    const headers = Object.fromEntries(['cache-control', 'referrer-policy', 'x-content-type-options', 'vary'].map(k => [k, response.headers.get(k)]))
    checks.push(result(name, response.status, 404, { headers, bodyBytes: (await response.arrayBuffer()).byteLength }))
    checks.push(result(name + ':private-cache', headers['cache-control'], 'private, no-store, max-age=0'))
    checks.push(result(name + ':no-referrer', headers['referrer-policy'], 'no-referrer'))
    checks.push(result(name + ':nosniff', headers['x-content-type-options'], 'nosniff'))
    checks.push(result(name + ':vary-cookie', /(^|,\s*)Cookie(,|$)/i.test(headers.vary ?? ''), true))
  }
  return { deployedSha, observedAt: new Date().toISOString(), scope: 'Public production media negative paths only; no credentials, no fixtures, no writes, no provider calls.', checks }
}

// Caller supplies its existing authenticated Playwright APIRequestContext.
// This function never obtains, prints or saves credentials/session state.
// Only these reviewed routes/payloads are allowed: validation rejects occur
// before submitVideoJob, and subtitles without targetLang have no provider path.
export async function authenticatedFreeChecks(request) {
  const checks = []
  for (const path of ['/api/create', '/api/production', '/api/video/export']) {
    const response = await request.post(origin + path, { data: {} })
    checks.push(result(path + ':invalid-before-job', response.status(), 400))
  }
  const subtitles = [{ text: 'Controle SUTRA gratuit.', start: 0, end: 2.5 }, { text: 'Aucun fournisseur appele.', start: 2.5, end: 5 }]
  const exported = await request.post(origin + '/api/subtitles/export', { data: { subtitles } })
  const srt = await exported.text()
  checks.push(result('srt-export:status', exported.status(), 200))
  checks.push(result('srt-export:attachment', exported.headers()['content-disposition'], 'attachment; filename="subtitles.srt"'))
  checks.push(result('srt-export:exact-content', srt, '1\n00:00:00,000 --> 00:00:02,500\nControle SUTRA gratuit.\n\n2\n00:00:02,500 --> 00:00:05,000\nAucun fournisseur appele.'))
  const generated = await request.post(origin + '/api/subtitles', { data: { narration: 'Controle SUTRA gratuit. Aucun fournisseur appele.', duration: 5, style: 'classic' } })
  checks.push(result('subtitles-local:status', generated.status(), 200))
  const body = await generated.json()
  checks.push(result('subtitles-local:entries', Array.isArray(body.subtitles) && body.subtitles.length > 0 && body.subtitles.every(e => typeof e.text === 'string' && e.start >= 0 && e.end >= e.start && e.end <= 5), true))
  checks.push(result('subtitles-local:srt', typeof body.srt === 'string' && body.srt.includes(' --> ') && body.srt.includes('Controle SUTRA gratuit.'), true))
  return { deployedSha, observedAt: new Date().toISOString(), scope: 'Authenticated production schema validation rejects and deterministic subtitle generation/export only; no job submitted and no paid provider route.', checks }
}

export async function ownedMediaChecks(request, { objectPath, sha256, byteLength, storageOrigin }) {
  // Root coordinator alone provisions/removes an owned synthetic storage object.
  if (!/^owners\/[0-9a-f-]{36}\/postdeploy\//.test(objectPath)) throw new Error('Only owned postdeploy fixture paths are accepted')
  const checks = []
  const url = origin + '/api/media/' + ref(objectPath)
  const response = await request.get(url, { maxRedirects: 0 })
  checks.push(result('owned-media:redirect', response.status(), 307))
  checks.push(result('owned-media:private-cache', response.headers()['cache-control'], 'private, no-store, max-age=0'))
  const location = response.headers().location
  if (!location || new URL(location).origin !== storageOrigin || new URL(location).protocol !== 'https:') throw new Error('Unexpected signed Storage destination; not followed')
  const bytesResponse = await request.get(location)
  const bytes = await bytesResponse.body()
  checks.push(result('owned-media:storage-status', bytesResponse.status(), 200))
  checks.push(result('owned-media:length', bytes.length, byteLength))
  checks.push(result('owned-media:sha256', createHash('sha256').update(bytes).digest('hex'), sha256))
  const ranged = await request.get(location, { headers: { Range: 'bytes=0-15' } })
  const rangedBytes = await ranged.body()
  checks.push(result('owned-media:range-status', ranged.status(), 206))
  checks.push(result('owned-media:range-bytes', rangedBytes.equals(bytes.subarray(0, 16)), true))
  const anonymous = await publicGet(url)
  checks.push(result('owned-media:anonymous-denied', anonymous.status, 401))
  const foreignPath = objectPath.replace(/^owners\/[^/]+\//, 'owners/00000000-0000-0000-0000-000000000000/')
  const foreign = await request.get(origin + '/api/media/' + ref(foreignPath), { maxRedirects: 0 })
  checks.push(result('owned-media:foreign-owner-denied', foreign.status(), 404))
  return { deployedSha, observedAt: new Date().toISOString(), scope: 'Real private Storage synthetic fixture; signed URL deliberately omitted from evidence.', checks }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = await publicMediaChecks()
  const filename = new URL('./public-media.json', import.meta.url)
  await writeFile(filename, JSON.stringify(output, null, 2) + '\n')
  const pass = output.checks.filter(c => c.status === 'PASS').length
  console.log(JSON.stringify({ deployedSha, passed: pass, failed: output.checks.length - pass }))
  if (pass !== output.checks.length) process.exitCode = 1
}
