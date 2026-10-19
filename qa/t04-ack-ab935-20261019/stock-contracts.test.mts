import assert from 'node:assert/strict'
import { after, test } from 'node:test'

// Offline only: every outbound request is replaced before the adapter is imported.
const variables = ['PEXELS_API_KEY', 'PIXABAY_API_KEY', 'UNSPLASH_ACCESS_KEY', 'COVERR_API_KEY']
const previous = variables.map(name => process.env[name])
for (const name of variables) process.env[name] = 'fixture-only-key'
const nativeFetch = globalThis.fetch
globalThis.fetch = async () => { throw new Error('NETWORK_FORBIDDEN') }
const { searchStock } = await import('../../src/lib/stock.ts')
after(() => {
  globalThis.fetch = nativeFetch
  variables.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i] })
})
const empty = () => Response.json({ videos: [], photos: [], hits: [], results: [] })
const photo = { id: 1, width: 3840, height: 2160, url: 'https://www.pexels.com/photo/1',
  photographer: 'Fixture', src: { original: 'https://images.pexels.com/1.jpg', large: 'https://images.pexels.com/1.jpg' } }

for (const status of [401, 403, 429, 500]) test(`HTTP ${status} cannot become a successful empty search or retry`, async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response('SECRET_ECHO_DO_NOT_LOG', { status }) }
  await assert.rejects(searchStock({ query: 'nature', type: 'photo' }), error => {
    assert.match(String(error), /STOCK_SEARCH_FAILED/)
    assert.doesNotMatch(String(error), /SECRET_ECHO/)
    return true
  })
  assert.equal(calls, 2)
})

test('malformed HTTP 200 is not an empty catalogue', async () => {
  globalThis.fetch = async () => Response.json({ unexpected: true })
  await assert.rejects(searchStock({ query: 'nature' }))
})

test('one failed configured source does not disappear behind successful sources', async () => {
  globalThis.fetch = async url => String(url).includes('unsplash')
    ? new Response(null, { status: 401 }) : Response.json({ photos: [photo] })
  await assert.rejects(searchStock({ query: 'nature', type: 'photo' }))
})

test('Pixabay unsafe media URL is rejected', async () => {
  globalThis.fetch = async url => String(url).includes('pixabay') ? Response.json({ hits: [{ id: 1,
    videos: { large: { url: 'javascript:alert(1)', width: 1920, height: 1080 } } }] }) : empty()
  await assert.rejects(searchStock({ query: 'nature', type: 'video' }))
})

test('GET transport has a finite deadline, forbids redirects and adds Coverr auth/urls', async () => {
  const calls: Array<{ url: URL; init: RequestInit | undefined }> = []
  globalThis.fetch = async (request, init) => {
    const url = new URL(String(request)); calls.push({ url, init })
    return empty()
  }
  assert.deepEqual(await searchStock({ query: 'nature' }), [])
  assert.equal(calls.length, 5)
  for (const { url, init } of calls) {
    assert.equal(init?.method, 'GET')
    assert.equal(init?.redirect, 'error')
    assert.ok(init?.signal instanceof AbortSignal)
    if (url.hostname === 'api.coverr.co') {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fixture-only-key')
      assert.equal(url.searchParams.get('urls'), 'true')
      assert.equal(url.searchParams.has('api_key'), false)
    }
  }
})

test('valid empty catalogues remain empty', async () => {
  globalThis.fetch = async () => empty()
  assert.deepEqual(await searchStock({ query: 'nature' }), [])
})

test('valid media keeps dimensions, provenance and quality', async () => {
  globalThis.fetch = async url => String(url).includes('/v1/search') ? Response.json({ photos: [photo] }) : empty()
  const results = await searchStock({ query: 'nature' })
  assert.equal(results.length, 1)
  assert.equal(results[0].source, 'pexels')
  assert.equal(results[0].quality, '4k')
  assert.equal(results[0].pageUrl, photo.url)
})

test('Pixabay and Unsplash valid responses retain author and source', async () => {
  globalThis.fetch = async request => {
    const host = new URL(String(request)).hostname
    if (host === 'pixabay.com') return Response.json({ hits: [{ id: 2, pageURL: 'https://pixabay.com/videos/2', user: 'A',
      videos: { large: { url: 'https://cdn.pixabay.com/2.mp4', width: 1920, height: 1080 },
        tiny: { url: '', width: 0, height: 0 } } }] })
    if (host === 'api.unsplash.com') return Response.json({ results: [{ id: '3', width: 3840, height: 2160,
      urls: { full: 'https://images.unsplash.com/3?ixid=fixture', regular: 'https://images.unsplash.com/3?ixid=fixture' },
      user: { name: 'B' }, links: { html: 'https://unsplash.com/photos/3' } }] })
    return empty()
  }
  const results = await searchStock({ query: 'nature' })
  assert.deepEqual(results.map(r => [r.source, r.quality, r.author]), [['unsplash', '4k', 'B'], ['pixabay', '1080p', 'A']])
  assert.match(results[0].url, /ixid=fixture/)
})

test('Pexels ignores dimensionless/non-MP4 variants rather than relabeling them HD', async () => {
  globalThis.fetch = async request => String(request).includes('/videos/search') ? Response.json({ videos: [{
    id: 4, url: 'https://www.pexels.com/video/4', image: 'https://images.pexels.com/4.jpg', duration: 6,
    video_files: [{ link: 'https://videos.pexels.com/4.mp4', width: null, height: null },
      { link: 'https://videos.pexels.com/4.m3u8', width: 3840, height: 2160, file_type: 'application/x-mpegURL' },
      { link: 'https://videos.pexels.com/4-hd.mp4', width: 1920, height: 1080, file_type: 'video/mp4' }],
  }] }) : empty()
  const [video] = await searchStock({ query: 'nature', type: 'video' })
  assert.equal(video.quality, '1080p')
  assert.equal(video.url, 'https://videos.pexels.com/4-hd.mp4')
})

test('Coverr previews cannot inherit max dimensions; download URL is preferred', async () => {
  const metadata = { id: '5', poster: 'https://storage.coverr.co/5.jpg', max_width: 3840, max_height: 2160 }
  globalThis.fetch = async request => String(request).includes('api.coverr.co') ? Response.json({ hits: [
    { ...metadata, urls: { mp4_preview: 'https://storage.coverr.co/5-preview.mp4' } },
    { ...metadata, id: '6', urls: { mp4: 'https://storage.coverr.co/6.mp4', mp4_download: 'https://storage.coverr.co/6/download' } },
  ] }) : empty()
  const results = await searchStock({ query: 'nature', type: 'video' })
  assert.equal(results.length, 1)
  assert.equal(results[0].url, 'https://storage.coverr.co/6/download')
})

test('missing Coverr key causes no anonymous request; no sources is an explicit failure', async () => {
  delete process.env.COVERR_API_KEY
  const hosts: string[] = []
  globalThis.fetch = async request => { hosts.push(new URL(String(request)).hostname); return empty() }
  try {
    await searchStock({ query: 'nature' })
    assert.equal(hosts.includes('api.coverr.co'), false)
    variables.forEach(name => { delete process.env[name] })
    await assert.rejects(searchStock({ query: 'nature' }), /STOCK_NOT_CONFIGURED/)
    assert.equal(hosts.length, 4)
    assert.deepEqual(await searchStock({ query: ' ' }), [])
  } finally { variables.forEach(name => { process.env[name] = 'fixture-only-key' }) }
})

test('oversized and non-object response bodies fail without echoing body contents', async () => {
  for (const response of [() => new Response('SECRET_ECHO', { headers: { 'content-length': '2097153' } }),
    () => Response.json([]), () => new Response('SECRET_ECHO')]) {
    globalThis.fetch = async () => response()
    await assert.rejects(searchStock({ query: 'nature' }), error => {
      assert.doesNotMatch(String(error), /SECRET_ECHO/); return true
    })
  }
})

for (const phase of ['headers', 'body']) test(`deadline includes stalled ${phase}, no retry`, async () => {
  const timeout = AbortSignal.timeout
  let calls = 0; let cancelled = 0
  const keepAlive = setTimeout(() => {}, 1000)
  // Shorten only the real 15s signal in this offline test.
  AbortSignal.timeout = milliseconds => { assert.equal(milliseconds, 15_000); return timeout(20) }
  globalThis.fetch = async (_request, init) => {
    calls++
    if (phase === 'headers') return new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => { cancelled++; reject(new Error('SECRET_ECHO')) }, { once: true })
    })
    return new Response(new ReadableStream({ cancel() { cancelled++ } }))
  }
  try {
    await assert.rejects(searchStock({ query: 'nature', type: 'photo' }), /STOCK_SEARCH_FAILED/)
    assert.equal(calls, 2)
    assert.equal(cancelled, 2)
  } finally { AbortSignal.timeout = timeout; clearTimeout(keepAlive) }
})
