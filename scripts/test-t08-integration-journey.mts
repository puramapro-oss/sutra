// Independent route -> queue -> worker -> pipeline -> export -> social journal journey.
// Only persistence, session and external provider/media I/O are fixtures. No network/AI/GPU.
import test, { beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { journeyDatabase } from '../qa/t08-integration-journey-20261014/database.mts'
import { simulatedValidation } from './helpers/media-validation-fixture.ts'
import { compositionPlan, type CompositionContract } from '../src/lib/composition-contract.ts'
import type { AssembleResult } from '../src/lib/shotstack.ts'
import type { VideoCompositionJob } from '../src/lib/video-compositor.ts'
import { SUPER_ADMIN_EMAIL } from '../src/lib/constants.ts'
import { awaitGeneration } from '../src/lib/generation-client.ts'

type Session = { id: string; email: string } | null
type Body = Record<string, unknown>
const session = new AsyncLocalStorage<Session>()
const client = { id: 'u', email: 'client@fixture.invalid' }
let db = journeyDatabase()
const counts = { script: 0, voice: 0, music: 0, visual: 0, render: 0, renderPoll: 0, verify: 0, validate: 0, upload: 0, external: 0 }
const failures = { renderTimeout: false, validation: false, voiceUpload: false }
const http: Array<{ method: string; path: string; body: Body | null; key: string | null }> = []
const remote = new Map<string, { _id: string; status: string; platforms: Array<Body> }>()
let publicationState: 'scheduled' | 'published' | 'partial' = 'scheduled'
let renderGate: Promise<void> | undefined
const raw = 'https://media.fixture.invalid/raw.mp4'
const input = { topic: 'Recette T08 frontieres et reprise', quality: '720p', format: '16:9', engine: 'wan-classic' }

mock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: {
  getUser: async () => ({ data: { user: session.getStore() ?? null }, error: null }),
} }) } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => db.client } })
mock.module('@supabase/supabase-js', { namedExports: { createClient: () => db.client } })
const claude = await import('../src/lib/claude.ts')
mock.module('../src/lib/claude.ts', { namedExports: { ...claude, generateScript: async () => {
  counts.script++
  return { title: 'Projet T08', description: 'Fixture sans generation reelle', tags: ['qa'], narration: 'Une premiere scene. Une seconde scene.',
    music_style: 'cinematic', music_prompt: 'Fixture', estimated_duration: 12,
    scenes: [0, 1].map(index => ({ narration: `Scene ${index}`, visual_prompt: `Fixture ${index}`, duration_seconds: 6, use_stock: false })) }
} } })
const fallbacks = await import('../src/lib/fallbacks.ts')
mock.module('../src/lib/fallbacks.ts', { namedExports: { ...fallbacks,
  generateVoiceWithFallback: async () => { counts.voice++; return new Uint8Array([1, 2, 3]).buffer },
  generateVisualWithFallback: async () => { counts.visual++; return { url: raw, type: 'ia', engine: 'wan-classic', kind: 'video' } },
} })
const suno = await import('../src/lib/suno.ts')
mock.module('../src/lib/suno.ts', { namedExports: { ...suno, generateMusic: async () => {
  counts.music++; return { audio_url: 'https://media.fixture.invalid/music.mp3' }
} } })
const storage = await import('../src/lib/storage.ts')
mock.module('../src/lib/storage.ts', { namedExports: { ...storage, uploadToStorage: async () => {
  counts.upload++
  if (failures.voiceUpload) throw new Error('fixture upload timeout')
  return 'https://media.fixture.invalid/voice.mp3'
} } })
mock.module('../src/lib/video-proofs.ts', { namedExports: { stampVideoWhenReady: async () => ({ status: 'skipped' }) } })
mock.module('../src/lib/video-compositor.ts', { namedExports: { composeVideoWithFallback: async (job: VideoCompositionJob) => {
  if (job.renderJob?.id) counts.renderPoll++
  else {
    await job.renderJob?.onSubmitting?.()
    counts.render++
    await job.renderJob?.onSubmitted?.(`fixture-render-${counts.render}`)
  }
  await renderGate
  if (failures.renderTimeout) throw new Error('fixture render polling timeout')
  return { url: `https://media.fixture.invalid/render-${counts.render}.mp4`, durationSeconds: compositionPlan(job).total,
    engine: 'shotstack', timeline: { fixture: true } }
} } })
const shotstack = await import('../src/lib/shotstack.ts')
mock.module('../src/lib/shotstack.ts', { namedExports: { ...shotstack,
  verifyAndStoreRenderedVideo: async (result: AssembleResult) => {
    counts.verify++
    assert.ok(result.contract)
    const validation = simulatedValidation(result.contract)
    const url = result.url.replace('/render-', '/verified-')
    const verification = { url, sha256: validation.final.sha256, ...result.outputSize,
      duration: result.duration, fps: 30, hasAudio: true, bytes: 1000 }
    return { ...result, url, validation, outputVerified: true, verification,
      timeline: { ...result.timeline, sutraVerification: verification } }
  },
} })
const mediaValidation = await import('../src/lib/media-validation.ts')
mock.module('../src/lib/media-validation.ts', { namedExports: { ...mediaValidation,
  validateRenderedMedia: async (_url: string, contract: CompositionContract) => {
    counts.validate++
    if (failures.validation) throw new Error('SUTRA_MEDIA_VALIDATION_FAILED: fixture corrupt decoded media')
    return simulatedValidation(contract)
  },
} })

// Closed transport: the real Zernio request builder/parser runs, but no original fetch is reachable.
globalThis.fetch = async (resource, options) => {
  const url = new URL(typeof resource === 'string' || resource instanceof URL ? resource : resource.url)
  if (url.origin !== 'https://zernio.com' || !/^\/api\/v1\/posts(?:\/[a-f0-9]{24}(?:\/retry)?)?$/.test(url.pathname)) {
    counts.external++; throw new Error('T08_UNEXPECTED_NETWORK')
  }
  const method = options?.method ?? 'GET'
  const body = options?.body ? JSON.parse(String(options.body)) as Body : null
  const key = new Headers(options?.headers).get('Idempotency-Key')
  assert.equal(options?.redirect, 'error')
  http.push({ method, path: url.pathname, body, key })
  if (method === 'POST' && url.pathname.endsWith('/posts')) {
    assert.ok(key)
    const id = (remote.size + 1).toString(16).padStart(24, '0')
    const targets = body!.platforms as Body[]
    const post = { _id: id, status: publicationState === 'scheduled' ? 'scheduled' : 'published',
      platforms: targets.map(target => ({ ...target, status: publicationState === 'scheduled' ? 'pending'
        : publicationState === 'partial' && target.platform === 'instagram' ? 'failed' : 'published' })) }
    remote.set(id, post)
    return Response.json({ post }, { status: 201 })
  }
  const id = url.pathname.split('/')[4]
  const post = remote.get(id)
  assert.ok(post, 'recovery must address an existing simulated post')
  if (method === 'POST') {
    assert.ok(url.pathname.endsWith('/retry'))
    post.platforms.forEach(target => { target.status = 'published' })
  }
  return Response.json({ post })
}

const { POST: create } = await import('../src/app/api/create/route.ts')
const { POST: exportVideo } = await import('../src/app/api/video/export/route.ts')
const { POST: publish } = await import('../src/app/api/social/publish/route.ts')
const { GET: status } = await import('../src/app/api/video/status/[jobId]/route.ts')

beforeEach(() => {
  db = journeyDatabase()
  for (const name of Object.keys(counts) as Array<keyof typeof counts>) counts[name] = 0
  Object.assign(failures, { renderTimeout: false, validation: false, voiceUpload: false })
  http.length = 0; remote.clear(); publicationState = 'scheduled'; renderGate = undefined
  process.env.SALAD_ENABLED = 'false'; process.env.LOCAL_ENGINE_ENABLED = 'false'
  process.env.ZERNIO_API_KEY = 'fixture-only'
})
afterEach(() => assert.equal(counts.external, 0, 'zero unexpected network attempts'))

async function call(route: (r: Request) => Promise<Response>, body: Body, key: string, user: Session = client) {
  return session.run(user, async () => {
    const response = await route(new Request('https://sutra.fixture.invalid/api/fixture', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) }))
    return { status: response.status, body: await response.json() as Body }
  })
}
async function project(key = 'project') {
  const response = await call(create, input, key)
  assert.equal(response.status, 200, JSON.stringify({ response, errors: db.jobs.map(j => j.last_error) }))
  const video = response.body.video as Body
  assert.equal(video.user_id, client.id); assert.equal(video.status, 'ready')
  return video
}
function edit(video: Body) {
  const timeline = video.shotstack_json as { sutraEditorClips: Body[] }
  return { videoId: video.id, quality: '720p', scenes: timeline.sutraEditorClips,
    subtitles: [{ text: 'Sous titre edite par T08', start: 0, end: 5 }], voiceVolume: 1, musicVolume: 0.2 }
}
const newPosts = () => http.filter(r => r.method === 'POST' && r.path.endsWith('/posts'))

test('J01 session -> project -> quota -> simulated generation -> resume -> edit -> validation -> export -> schedule -> publication', async () => {
  assert.equal((await call(create, input, 'journey', null)).status, 401)
  assert.equal(db.jobs.length, 0)
  failures.renderTimeout = true
  const interrupted = await call(create, input, 'journey')
  assert.equal(interrupted.status, 503)
  assert.equal(db.jobs.length, 1)
  const job = db.jobs[0]
  assert.equal((job.progress.steps as Body).assembly_render_id, 'fixture-render-1')
  assert.equal(db.tables.videos[0].status, 'generating')
  assert.deepEqual(db.accounting(), { reservations: 1, settlements: 0 })
  assert.equal((await call(publish, { videoId: job.video_id, platforms: ['youtube'] }, 'premature')).status, 409)
  assert.equal(http.length, 0)
  failures.renderTimeout = false
  const resumed = await call(create, input, 'journey')
  assert.equal(resumed.status, 200, JSON.stringify({ resumed, error: job.last_error }))
  const video = resumed.body.video as Body
  assert.equal(video.id, job.video_id)
  assert.equal(counts.render, 1); assert.equal(counts.renderPoll, 1)
  assert.deepEqual([counts.script, counts.voice, counts.music, counts.visual], [1, 1, 1, 2])
  assert.deepEqual(db.accounting(), { reservations: 1, settlements: 1 })
  for (const stage of ['script', 'scenes', 'images', 'voice', 'music', 'subtitles', 'composition', 'export', 'publication']) {
    assert.ok((job.progress.steps as Body)[`stage:${stage}`], `durable checkpoint ${stage}`)
  }
  const exported = await call(exportVideo, edit(video), 'edit-1')
  assert.equal(exported.status, 200, JSON.stringify({ exported, errors: db.jobs.map(j => j.last_error) }))
  assert.notEqual(exported.body.url, video.video_url)
  assert.equal(db.tables.videos[0].video_url, exported.body.url)
  assert.equal(counts.validate, 1)
  const beforeReplay = { ...counts }
  assert.equal((await call(exportVideo, edit(video), 'edit-1')).status, 200)
  assert.deepEqual(counts, beforeReplay)
  const scheduledAt = new Date(Date.now() + 86_400_000).toISOString()
  const publication = { videoId: video.id, platforms: ['youtube'], scheduledAt, caption: 'Projet exporte T08' }
  const scheduled = await call(publish, publication, 'schedule')
  assert.equal(scheduled.status, 202, JSON.stringify(scheduled))
  assert.equal(scheduled.body.success, false); assert.equal(scheduled.body.status, 'scheduled')
  assert.deepEqual(newPosts()[0].body?.mediaItems, [{ type: 'video', url: exported.body.url }])
  assert.equal(newPosts()[0].body?.scheduledFor, scheduledAt)
  assert.equal(db.tables.videos[0].status, 'ready')
  assert.equal(db.tables.scheduled_posts[0].status, 'scheduled')
  for (const post of remote.values()) { post.status = 'published'; post.platforms.forEach(p => { p.status = 'published' }) }
  const published = await call(publish, publication, 'schedule')
  assert.equal(published.status, 200, JSON.stringify(published))
  assert.equal(published.body.status, 'published'); assert.equal(published.body.success, true)
  assert.equal(newPosts().length, 1); assert.ok(http.some(r => r.method === 'GET'))
  assert.equal(db.tables.videos[0].status, 'published')
  assert.equal(db.tables.social_posts[0].status, 'published')
  assert.equal(db.tables.scheduled_posts[0].status, 'published')
})

test('J02 bounded 12-click burst shares one queued job, project and provider intent; changed content conflicts', async () => {
  let release!: () => void
  renderGate = new Promise<void>(resolve => { release = resolve })
  const requests = Array.from({ length: 12 }, () => call(create, input, 'burst'))
  // A bounded event-loop turn lets the first request reach its simulated render.
  await new Promise<void>(resolve => setImmediate(resolve))
  release()
  const responses = await Promise.all(requests)
  assert.equal(responses.filter(r => r.status === 200).length, 1)
  assert.equal(responses.filter(r => r.status === 202).length, 11)
  assert.equal(new Set(responses.map(r => r.body.jobId)).size, 1)
  assert.equal(db.jobs.length, 1); assert.equal(db.tables.videos.length, 1)
  assert.deepEqual(db.accounting(), { reservations: 1, settlements: 1 })
  assert.deepEqual([counts.script, counts.voice, counts.music, counts.visual, counts.render], [1, 1, 1, 2, 1])
  // Exercise the actual client polling contract against the actual status route.
  const accepted = responses.find(r => r.status === 202)!
  const resolved = await session.run(client, () => awaitGeneration(Response.json(accepted.body, { status: 202 }),
    new AbortController().signal, { delay: async () => undefined, fetch: async (url, options) => {
      assert.equal(options?.cache, 'no-store')
      assert.equal(String(url), `/api/video/status/${db.jobs[0].id}`)
      return status(new Request(`https://sutra.fixture.invalid${url}`), { params: Promise.resolve({ jobId: db.jobs[0].id }) })
    } }))
  assert.equal(resolved, db.tables.videos[0].id)
  const before = { ...counts }
  assert.equal((await call(create, { ...input, topic: 'Autre demande' }, 'burst')).status, 409)
  assert.deepEqual(counts, before)
})

test('J03 quota or submission DB refusal has no orphan project or provider effects', async () => {
  for (const fault of ['quota', 'submit'] as const) {
    db.faults[fault] = true
    assert.equal((await call(create, input, fault)).status, fault === 'quota' ? 403 : 503)
    assert.equal(db.jobs.length, 0); assert.equal(db.tables.videos.length, 0)
    assert.ok(Object.values(counts).every(n => n === 0))
    db.faults[fault] = false
  }
  await project()
  assert.ok(db.calls.find(c => c.name === 'submit_video_job')?.args.p_limit as number > 0)
})

test('J04 upload failure resumes stored voice and other resolved assets, without resynthesis', async () => {
  failures.voiceUpload = true
  assert.equal((await call(create, input, 'upload')).status, 503)
  assert.equal(counts.render, 0)
  failures.voiceUpload = false
  assert.equal((await call(create, input, 'upload')).status, 200)
  assert.deepEqual([counts.script, counts.voice, counts.music, counts.visual, counts.render], [1, 1, 1, 2, 1])
  assert.equal(counts.upload, 2)
})

test('J05 ready-write DB failure cannot publish; resume reuses verified media and settles once', async () => {
  db.faults.persistReady = true
  assert.equal((await call(create, input, 'persist')).status, 503)
  const job = db.jobs[0]
  assert.equal((await call(publish, { videoId: job.video_id, platforms: ['youtube'] }, 'blocked')).status, 409)
  assert.equal(http.length, 0)
  db.faults.persistReady = false
  assert.equal((await call(create, input, 'persist')).status, 200)
  assert.equal(counts.render, 1); assert.equal(counts.verify, 1)
  assert.deepEqual(db.accounting(), { reservations: 1, settlements: 1 })
})

test('J06 created client project remains isolated across status, export and publication boundaries', async () => {
  const video = await project()
  const stranger = { id: 'other', email: 'other@fixture.invalid' }
  const before = { ...counts }
  assert.equal((await call(exportVideo, edit(video), 'steal', stranger)).status, 404)
  assert.equal((await call(publish, { videoId: video.id, platforms: ['youtube'] }, 'steal', stranger)).status, 409)
  const jobStatus = await session.run(stranger, () => status(new Request('https://sutra.fixture.invalid/status'),
    { params: Promise.resolve({ jobId: db.jobs[0].id }) }))
  assert.equal(jobStatus.status, 404)
  assert.deepEqual(counts, before); assert.equal(http.length, 0)
  // Real preflight must still precede submission even after a successful client journey.
  const owner = { id: 'owner', email: SUPER_ADMIN_EMAIL }
  db.tables.profiles.push({ ...db.profile, ...owner })
  const disabled = await call(create, input, 'owner', owner)
  assert.equal(disabled.status, 503); assert.equal(disabled.body.code, 'SALAD_DISABLED')
  assert.equal(db.jobs.length, 1); assert.deepEqual(counts, before)
})

test('J07 corrupt export validation preserves prior ready media and retry does not render again', async () => {
  const video = await project()
  failures.validation = true
  assert.equal((await call(exportVideo, edit(video), 'corrupt')).status, 503)
  assert.equal(db.tables.videos[0].video_url, video.video_url)
  assert.equal(counts.render, 2)
  failures.validation = false
  const repaired = await call(exportVideo, edit(video), 'corrupt')
  assert.equal(repaired.status, 200, JSON.stringify({ repaired, errors: db.jobs.map(j => j.last_error) }))
  assert.equal(counts.render, 2); assert.equal(counts.validate, 2)
  assert.equal(db.tables.videos[0].video_url, repaired.body.url)
})

test('J08 two destination partial publication reconciles existing posts, never republishes the successful target', async () => {
  const video = await project()
  publicationState = 'partial'
  const request = { videoId: video.id, platforms: ['youtube', 'instagram'] }
  const partial = await call(publish, request, 'partial')
  assert.equal(partial.body.status, 'partially_published', JSON.stringify(partial))
  assert.equal(partial.body.success, false); assert.equal(db.tables.videos[0].status, 'ready')
  const initialPosts = newPosts().length
  const resumed = await call(publish, request, 'partial')
  assert.equal(resumed.body.status, 'published', JSON.stringify(resumed))
  assert.equal(newPosts().length, initialPosts)
  const retries = http.filter(r => r.path.endsWith('/retry'))
  assert.equal(retries.length, 1)
  const retriedId = retries[0].path.split('/')[4]
  assert.deepEqual(remote.get(retriedId)?.platforms.map(p => p.platform), ['instagram'])
  assert.equal(db.tables.social_posts.length, 2)
})

test('J09 changed or missing final proof and revoked access block simulated publication', async () => {
  const video = await project()
  const row = db.tables.videos[0]
  const timeline = row.shotstack_json
  row.shotstack_json = {}
  const missing = await call(publish, { videoId: video.id, platforms: ['youtube'] }, 'proof')
  assert.equal(missing.body.code, 'SUTRA_PUBLICATION_MEDIA_VERIFICATION_REQUIRED')
  row.shotstack_json = timeline
  db.profile.access_revoked_at = new Date().toISOString()
  const revoked = await call(publish, { videoId: video.id, platforms: ['youtube'] }, 'revoke')
  assert.equal(revoked.body.code, 'SUTRA_ACCOUNT_ACCESS_DENIED')
  assert.equal(http.length, 0)
})

test('J10 lost remote render receipt stays uncertain across route retry without another submission', async () => {
  db.faults.checkpoint = 'assembly_render_id'
  assert.equal((await call(create, input, 'unknown-render')).status, 503)
  assert.equal(counts.render, 1)
  const steps = db.jobs[0].progress.steps as Body
  assert.equal(steps.assembly_submission_started, true)
  assert.equal(steps.assembly_render_id, undefined)
  db.faults.checkpoint = ''
  const retried = await call(create, input, 'unknown-render')
  assert.equal(retried.status, 503)
  assert.equal(counts.render, 1); assert.equal(counts.renderPoll, 0)
  assert.match(db.jobs[0].last_error ?? '', /SUTRA_RECONCILIATION_REQUIRED/)
  assert.equal(db.tables.videos[0].status, 'generating')
  assert.equal(db.accounting().settlements, 0)
  assert.equal(http.length, 0)
})

test('J11 bounded 12-click publication burst sends one verified media intent and repairs projections', async () => {
  const video = await project()
  publicationState = 'published'
  const request = { videoId: video.id, platforms: ['youtube'] }
  const results = await Promise.all(Array.from({ length: 12 }, () => call(publish, request, 'publish-burst')))
  assert.ok(results.every(result => [200, 202, 409].includes(result.status)))
  assert.equal(newPosts().length, 1)
  const settled = await call(publish, request, 'publish-burst')
  assert.equal(settled.body.status, 'published', JSON.stringify(settled))
  assert.equal(newPosts().length, 1)
  assert.equal(db.tables.social_posts.length, 1)
  assert.equal(db.tables.scheduled_posts.length, 1)
  assert.equal(db.tables.social_publication_journals.length, 1)
})

test('J12 re-export after a scheduled intent cannot silently replace the scheduled verified media', async () => {
  const video = await project()
  const request = { videoId: video.id, platforms: ['youtube'], scheduledAt: new Date(Date.now() + 86_400_000).toISOString() }
  assert.equal((await call(publish, request, 'scheduled')).body.status, 'scheduled')
  const exported = await call(exportVideo, edit(video), 'new-version')
  assert.equal(exported.status, 200)
  assert.notEqual(exported.body.url, video.video_url)
  const changed = await call(publish, request, 'scheduled')
  assert.equal(changed.status, 409)
  assert.equal(changed.body.code, 'SUTRA_MEDIA_CHANGED')
  assert.equal(newPosts().length, 1)
  assert.deepEqual(newPosts()[0].body?.mediaItems, [{ type: 'video', url: video.video_url }])
})

test('J13 a past schedule cannot turn into immediate publication after successful export', async () => {
  const video = await project()
  assert.equal((await call(exportVideo, edit(video), 'export')).status, 200)
  const past = await call(publish, { videoId: video.id, platforms: ['youtube'], scheduledAt: '2020-01-01T00:00:00Z' }, 'past')
  assert.equal(past.status, 409)
  assert.equal(past.body.code, 'SUTRA_ZERNIO_SCHEDULE_MUST_BE_FUTURE')
  assert.equal(http.length, 0); assert.equal(db.tables.videos[0].status, 'ready')
})
