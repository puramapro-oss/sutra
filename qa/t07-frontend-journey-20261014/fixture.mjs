import { createServer } from 'node:http'
import { createServer as createSecureServer } from 'node:https'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'

export async function startFixture(tlsOptions) {
  const mediaBytes = await readFile(new URL('./fixture-video.mp4', import.meta.url))
  const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'legal-test@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { name: 'Legal Test' }, created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() }
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), email: user.email })).toString('base64url')}.fixture-signature`
  const profile = { id: user.id, email: user.email, name: 'Legal Test', plan: 'creator', credits: 40, monthly_video_count: 0, is_admin: false, tutorial_completed: true, brand_kit: null }
  const state = { acceptances: [], writes: [], requests: [], legalMode: 'normal', delayMs: 250, videos: [], videoMode: 'normal', signatures: [], mediaMode: 'normal', mediaDelayMs: 0, suspendedMedia: [] }
  const handle = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    const url = new URL(req.url, 'http://fixture.invalid'), path = url.pathname
    state.requests.push({ path, method: req.method })
    const send = value => res.end(JSON.stringify(value))
    if (path === '/auth/v1/token') return send({ access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user })
    if (path === '/rest/v1/legal_acceptances' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk
      const value = JSON.parse(body)
      state.writes.push({ ...value, user_agent: 'redacted-fixture-browser', ip: 'loopback' })
      await new Promise(done => setTimeout(done, state.delayMs))
      if (state.legalMode === 'error') { res.writeHead(503); return send({ message: 'fixture_temporarily_unavailable' }) }
      const rows = Array.isArray(value) ? value : [value]
      for (const row of rows) {
        state.acceptances = state.acceptances.filter(a => a.doc_type !== row.doc_type)
        state.acceptances.push(row)
      }
      res.writeHead(201); return send(null)
    }
    const storagePath = `/storage/v1/object/sign/sutra-assets/owners/${user.id}/fixture.mp4`
    if (path === storagePath && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk
      const value = JSON.parse(body)
      state.signatures.push({ path, expiresIn: value.expiresIn })
      return send({ signedURL: path.replace('/storage/v1', '') + '?token=fixture-only' })
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return send({ error: 'fixture_forbids_mutation' }) }
    if (path === storagePath) {
      await new Promise(done => setTimeout(done, state.mediaDelayMs))
      if (state.mediaMode === 'denied') { res.writeHead(403); return send({ error: 'fixture_denied_private_diagnostic' }) }
      if (state.mediaMode === 'html') { res.setHeader('Content-Type', 'text/html'); return res.end('<html>not a video</html>') }
      res.setHeader('Content-Type', 'video/mp4')
      if (state.mediaMode === 'hang') {
        const transfer = { method: req.method, destination: req.headers['sec-fetch-dest'], path,
          status: 200, bytesWritten: 1, ended: false, closed: false }
        res.on('close', () => { transfer.closed = true })
        res.write(mediaBytes.subarray(0, 1))
        state.suspendedMedia.push(transfer)
        return
      }
      return res.end(state.mediaMode === 'corrupt' ? Buffer.from('different bytes') : mediaBytes)
    }
    if (path === '/media.mp4') { res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Content-Disposition', 'attachment; filename="sutra-video.mp4"'); return res.end(mediaBytes) }
    if (path === '/auth/v1/user') return send(user)
    if (path === '/rest/v1/profiles') return send(req.headers.accept?.includes('object+json') ? profile : [profile])
    if (path === '/rest/v1/legal_acceptances') return send(state.acceptances)
    if (path === '/rest/v1/videos') {
      if (state.videoMode === 'error') { res.writeHead(503); return send({ message: 'fixture_library_unavailable' }) }
      const rows = state.videos.filter(v => !url.searchParams.has('id') || url.searchParams.get('id') === `eq.${v.id}`)
      res.setHeader('Content-Range', rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0')
      return send(req.headers.accept?.includes('object+json') ? rows[0] ?? null : rows)
    }
    res.setHeader('Content-Range', '0-0/0')
    return send(req.headers.accept?.includes('object+json') ? null : [])
  }
  const server = tlsOptions ? createSecureServer(tlsOptions, handle) : createServer(handle)
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  return { server, state, user, url: `${tlsOptions ? 'https' : 'http'}://127.0.0.1:${server.address().port}` }
}
