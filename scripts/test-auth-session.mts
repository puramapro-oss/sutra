import test from 'node:test'
import assert from 'node:assert/strict'
import type { Session, AuthChangeEvent } from '@supabase/supabase-js'
import { createAuthSessionStore } from '../src/lib/auth-session-store.ts'
import { safeNextPath, sessionCookieOptions } from '../src/lib/auth-navigation.ts'

const pause = () => new Promise(resolve => setTimeout(resolve, 5))
async function waitFor(condition: () => boolean) {
  const deadline = Date.now() + 2_000
  while (!condition() && Date.now() < deadline) await pause()
  assert.ok(condition(), 'expected asynchronous request was observed')
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
function session(id: string, token = 'test-access'): Session {
  return { user: { id, email: `${id}@test.invalid` }, access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer' } as Session
}
function fixture(initial: Session | null = null) {
  let listener: ((event: AuthChangeEvent, value: Session | null) => void) | undefined
  const reads: { id: string; signal: AbortSignal; result: ReturnType<typeof deferred<{ data: unknown; error: unknown }>> }[] = []
  let subscriptions = 0, unsubscribes = 0, sessionReads = 0, insideCallback = false
  const initialResult = deferred<{ data: { session: Session | null }; error: null }>()
  const client = {
    auth: {
      getSession: () => { sessionReads++; return initialResult.promise },
      onAuthStateChange: (callback: typeof listener) => {
        subscriptions++; listener = callback
        return { data: { subscription: { unsubscribe: () => { unsubscribes++ } } } }
      },
    },
    from: () => {
      assert.equal(insideCallback, false, 'profile query must run outside the auth callback lock')
      let id: string, signal: AbortSignal
      const query = {
        select: () => query, eq: (_: string, value: string) => { id = value; return query },
        abortSignal: (value: AbortSignal) => { signal = value; return query },
        single: () => {
          const result = deferred<{ data: unknown; error: unknown }>()
          signal.addEventListener('abort', () => result.resolve({ data: null, error: new Error('aborted') }), { once: true })
          reads.push({ id, signal, result }); return result.promise
        },
      }; return query
    },
  }
  const store = createAuthSessionStore(client as unknown as Parameters<typeof createAuthSessionStore>[0])
  return {
    store, reads,
    initial: () => initialResult.resolve({ data: { session: initial }, error: null }),
    emit: (event: AuthChangeEvent, value: Session | null) => {
      insideCallback = true
      try { assert.equal(listener?.(event, value), undefined, 'auth callback is synchronous') } finally { insideCallback = false }
    },
    counts: () => ({ subscriptions, unsubscribes, sessionReads }),
  }
}

test('many consumers share one session read, subscription and profile request', async () => {
  const f = fixture(session('alice')); const stops = Array.from({ length: 12 }, () => f.store.subscribe(() => {}))
  f.initial(); await waitFor(() => f.reads.length >= 1)
  assert.deepEqual(f.counts(), { subscriptions: 1, unsubscribes: 0, sessionReads: 1 })
  assert.equal(f.reads.length, 1)
  f.reads[0].result.resolve({ data: { id: 'alice', name: 'Alice' }, error: null }); await pause()
  assert.equal(f.store.getSnapshot().profile?.name, 'Alice'); assert.equal(f.store.getSnapshot().loading, false)
  stops.slice(0, 11).forEach(stop => stop()); assert.equal(f.counts().unsubscribes, 0)
  stops[11](); assert.equal(f.counts().unsubscribes, 1)
})

test('token refresh updates the token without reloading a loaded profile', async () => {
  const f = fixture(session('alice')); const stop = f.store.subscribe(() => {}); f.initial(); await waitFor(() => f.reads.length >= 1)
  f.reads[0].result.resolve({ data: { id: 'alice' }, error: null }); await pause()
  f.emit('TOKEN_REFRESHED', session('alice', 'new-token')); await pause()
  assert.equal(f.store.getSnapshot().session?.access_token, 'new-token'); assert.equal(f.reads.length, 1); stop()
})

test('a newer sign-in wins over an older getSession result', async () => {
  const f = fixture(null); const stop = f.store.subscribe(() => {})
  f.emit('SIGNED_IN', session('alice')); f.initial(); await waitFor(() => f.reads.length >= 1)
  assert.equal(f.store.getSnapshot().user?.id, 'alice'); assert.equal(f.reads.length, 1); stop()
})

test('switching accounts clears the old profile and ignores its late response', async () => {
  const f = fixture(session('alice')); const stop = f.store.subscribe(() => {}); f.initial(); await waitFor(() => f.reads.length >= 1)
  f.emit('SIGNED_IN', session('bob'))
  assert.equal(f.store.getSnapshot().profile, null); assert.equal(f.reads[0].signal.aborted, true)
  await waitFor(() => f.reads.length >= 2); f.reads[0].result.resolve({ data: { id: 'alice' }, error: null }); f.reads[1].result.resolve({ data: { id: 'bob' }, error: null })
  await pause(); assert.equal(f.store.getSnapshot().profile?.id, 'bob'); stop()
})

test('sign-out cancels the in-flight profile and leaves no former user data', async () => {
  const f = fixture(session('alice')); const stop = f.store.subscribe(() => {}); f.initial(); await waitFor(() => f.reads.length >= 1)
  f.emit('SIGNED_OUT', null); await pause()
  assert.equal(f.store.getSnapshot().user, null); assert.equal(f.store.getSnapshot().profile, null); assert.equal(f.store.getSnapshot().loading, false); stop()
})

test('strict-mode cleanup and remount install a fresh working subscription', async () => {
  const f = fixture(session('alice')); const first = f.store.subscribe(() => {}); first()
  const stop = f.store.subscribe(() => {}); f.initial(); await waitFor(() => f.reads.length >= 1)
  assert.equal(f.counts().subscriptions, 2); assert.equal(f.reads.length, 1); stop()
})

test('wrong-owner profile is rejected and a refetch can recover', async () => {
  const f = fixture(session('alice')); const stop = f.store.subscribe(() => {}); f.initial(); await waitFor(() => f.reads.length >= 1)
  f.reads[0].result.resolve({ data: { id: 'bob' }, error: null }); await pause()
  assert.equal(f.store.getSnapshot().profile, null); assert.ok(f.store.getSnapshot().error); assert.equal(f.store.getSnapshot().loading, false)
  const pending = f.store.refetch(); assert.equal(f.reads.length, 2)
  f.reads[1].result.resolve({ data: { id: 'alice' }, error: null }); await pending
  assert.equal(f.store.getSnapshot().profile?.id, 'alice'); assert.equal(f.store.getSnapshot().error, null); stop()
})

test('simultaneous manual refreshes are deduplicated', async () => {
  const f = fixture(session('alice')); const stop = f.store.subscribe(() => {}); f.initial(); await waitFor(() => f.reads.length >= 1)
  const p1 = f.store.refetch(), p2 = f.store.refetch(); assert.equal(p1, p2); assert.equal(f.reads.length, 1)
  f.reads[0].result.resolve({ data: { id: 'alice' }, error: null }); await p1; stop()
})

test('the server snapshot never contains a client session', async () => {
  const f = fixture(session('alice')); const stop = f.store.subscribe(() => {}); f.initial(); await waitFor(() => f.reads.length >= 1)
  assert.equal(f.store.getServerSnapshot().user, null); assert.equal(f.store.getSnapshot().user?.id, 'alice'); stop()
})

for (const value of [null, '', 'https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/%2f%2fevil.invalid', '/%5cevil.invalid', '/login', '/api/delete', '/auth/callback', '/broken%zz', '/\n/evil.invalid']) {
  test(`reject unsafe or looping return path ${JSON.stringify(value)}`, () => assert.equal(safeNextPath(value), '/dashboard'))
}
for (const value of ['/create?mode=manual&format=9%3A16', '/settings?tab=apparence#logo', '/reset-password']) {
  test(`preserve return path ${value}`, () => assert.equal(safeNextPath(value), value))
}

test('session-only choice removes expiry on every refresh without changing cookie safety flags', () => {
  const original = { maxAge: 4000000, expires: new Date(), secure: true, sameSite: 'lax', path: '/' }
  const result = sessionCookieOptions(original, 'false')
  assert.equal(result.maxAge, undefined); assert.equal(result.expires, undefined); assert.equal(result.secure, true); assert.equal(result.path, '/')
  assert.equal(original.maxAge, 4000000)
})
test('remember-me uses thirty days', () => assert.equal(sessionCookieOptions({ maxAge: 123 }, 'true').maxAge, 2592000))
test('cookie deletion remains deletion', () => assert.equal(sessionCookieOptions({ maxAge: 0 }, 'false').maxAge, 0))
test('existing sessions without a new choice keep their prior cookie options', () => assert.equal(sessionCookieOptions({ maxAge: 123 }, undefined).maxAge, 123))

const { validateProfileImage } = await import('../src/lib/profile-image.ts')
test('raster image signatures determine storage type', async () => {
  assert.deepEqual(await validateProfileImage(new Blob([Uint8Array.from([137,80,78,71,13,10,26,10])], { type: 'image/png' })), { type: 'image/png', extension: 'png' })
  assert.deepEqual(await validateProfileImage(new Blob([Uint8Array.from([255,216,255,224])], { type: 'image/jpeg' })), { type: 'image/jpeg', extension: 'jpg' })
  assert.deepEqual(await validateProfileImage(new Blob(['RIFFxxxxWEBPxxxx'], { type: 'image/webp' })), { type: 'image/webp', extension: 'webp' })
})
test('image uploads reject SVG, MIME mismatch, empty and oversized files', async () => {
  for (const file of [new Blob(['<svg/>'], { type: 'image/svg+xml' }), new Blob([Uint8Array.from([255,216,255,224])], { type: 'image/png' }), new Blob([]), new Blob([new Uint8Array(5 * 1024 * 1024 + 1)])]) {
    await assert.rejects(validateProfileImage(file))
  }
})

test('literal internal navigation points to an existing page or declared redirect', async () => {
  const { readdirSync, readFileSync } = await import('node:fs')
  const { join, relative } = await import('node:path')
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])
  const pages = walk('src/app').filter(path => path.endsWith('/page.tsx')).map(path => {
    const route = '/' + relative('src/app', path).split('/').slice(0, -1).filter(part => !part.startsWith('(')).join('/')
    return new RegExp('^' + route.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/]+') + '/?$')
  })
  const redirects = [...readFileSync('next.config.ts', 'utf8').matchAll(/source:\s*"([^"]+)"/g)].map(match => match[1])
  const missing: string[] = []
  for (const file of walk('src').filter(path => path.endsWith('.tsx') || (path.startsWith('src/data/') && path.endsWith('.ts')))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:href\s*[:=]\s*|router\.(?:push|replace)\(\s*)[{]?(['"])(\/[^'"\n]*)\1/g)) {
      const path = match[2].split('?')[0].split('#')[0]
      if (path.startsWith('//') || path.startsWith('/api/') || path.includes('.') || redirects.includes(path)) continue
      if (!pages.some(route => route.test(path))) missing.push(`${file}: ${path}`)
    }
  }
  assert.deepEqual(missing, [])
})
