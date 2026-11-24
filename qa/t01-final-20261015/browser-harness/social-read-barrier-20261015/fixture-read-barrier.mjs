import assert from 'node:assert/strict'

// Scenario sequencing only: never intercept fetch, alter a response, or classify errors.
export function installFixtureReadBarrier(page, { appOrigin, fixtureOrigin, userId, timeout = 15000, includeLibrary = false }) {
  const app = new URL(appOrigin), fixture = new URL(fixtureOrigin)
  assert.ok([app, fixture].every(url => url.hostname === '127.0.0.1' && ['http:', 'https:'].includes(url.protocol)), 'loopback fixture only')
  assert.equal(userId, '11111111-1111-4111-8111-111111111111', 'synthetic identity only')
  const scopes = new Map([['/settings/social', { path: '/rest/v1/user_notifications', query: new URLSearchParams({ select: '*', user_id: `eq.${userId}`, order: 'created_at.desc', limit: '10' }) }]])
  if (includeLibrary) scopes.set('/library', { path: '/rest/v1/videos', query: new URLSearchParams({ select: '*', user_id: `eq.${userId}`, order: 'created_at.desc', offset: '0', limit: '12' }) })
  const requests = new Map(), documents = [], waits = [], listeners = new Set()
  let current
  const notify = () => { for (const listener of listeners) listener() }
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame()) return
    current = { id: documents.length + 1, url: frame.url(), reads: [] }
    documents.push(current); notify()
  })
  page.on('request', request => {
    const url = new URL(request.url())
    const source = current && new URL(current.url)
    const expected = source?.origin === app.origin && scopes.get(source.pathname)
    if (!expected || !current || request.frame() !== page.mainFrame() || request.method() !== 'GET'
      || url.origin !== fixture.origin || url.pathname !== expected.path
      || [...url.searchParams].length !== expected.query.size
      || [...expected.query].some(([key, value]) => url.searchParams.get(key) !== value)) return
    const row = { url: url.href, method: 'GET', startedAt: Date.now(), state: 'pending' }
    current.reads.push(row); requests.set(request, row); notify()
  })
  page.on('response', response => {
    const row = requests.get(response.request())
    if (row) { row.status = response.status(); notify() }
  })
  page.on('requestfinished', request => {
    const row = requests.get(request)
    if (row) { row.state = 'finished'; row.finishedAt = Date.now(); notify() }
  })
  page.on('requestfailed', request => {
    const row = requests.get(request)
    if (row) { row.state = 'failed'; row.failure = request.failure()?.errorText; notify() }
  })
  const beforeNavigation = async () => {
    const from = new URL(page.url())
    if (from.origin === app.origin && scopes.has(from.pathname)) {
      const document = current
      const wait = { document: document?.id, from: from.href, startedAt: Date.now(), status: 'waiting' }
      waits.push(wait)
      try {
        await new Promise((resolve, reject) => {
          let timer
          const done = error => {
            clearTimeout(timer); listeners.delete(check)
            if (error) reject(error)
            else resolve()
          }
          const check = () => {
            if (!document || current !== document) return done(new Error('fixture read barrier: source document changed'))
            if (document.reads.some(row => row.state === 'failed' || row.status !== undefined && row.status !== 200)) return done(new Error('fixture read barrier: read failed'))
            if (document.reads.length && document.reads.every(row => row.state === 'finished' && row.status === 200)) done()
          }
          timer = setTimeout(() => done(new Error('fixture read barrier: exact GET did not complete before deadline')), timeout)
          listeners.add(check); check()
        })
        // Let the document consume the finished response before destroying it.
        await page.evaluate(() => Promise.resolve())
        assert.equal(current, document, 'fixture read barrier: source document still current')
        wait.status = 'PASS'
      } catch (error) { wait.status = 'FAIL'; wait.message = error.message; throw error }
      finally { wait.finishedAt = Date.now() }
    }
  }
  for (const method of ['goto', 'reload']) {
    const original = page[method].bind(page)
    page[method] = async (...args) => {
      await beforeNavigation()
      return original(...args)
    }
  }
  return () => structuredClone({ documents, waits })
}
