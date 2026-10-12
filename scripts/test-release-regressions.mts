import { simulatedValidation } from './helpers/media-validation-fixture.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
process.env.NEXT_PUBLIC_APP_SCHEMA = 'sutra'
process.env.STRIPE_SECRET_KEY = 'sk_test_isolated'
process.env.RESEND_API_KEY = 're_isolated'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }

const { assertCronAuth } = await import('../src/lib/cron-auth.ts')
const { executeAutoJob } = await import('../src/lib/auto-pipeline.ts')
const { executeProductionStep, persistProductionResult } = await import('../src/lib/production-pipeline.ts')
const { executeExportJob, persistExportResult } = await import('../src/lib/export-pipeline.ts')
const { durableRenderJob, assembleFinalVideo } = await import('../src/lib/shotstack.ts')
const { autoOccurrences } = await import('../src/lib/sutra-auto-utils.ts')
const { publishAutoVideoRecord } = await import('../src/lib/sutra-auto.ts')
const queue = await import('../src/lib/video-queue.ts')
import type { AutoJobInput, AutoProviders } from '../src/lib/auto-pipeline.ts'
import type { ProductionJobInput, ProductionProviders } from '../src/lib/production-pipeline.ts'

const result = { url: 'https://media.invalid/final.mp4', duration: 6, outputQuality: 'hd' as const,
  outputSize: { width: 720, height: 1280 }, outputVerified: true as const, verification: { url: 'https://media.invalid/final.mp4', sha256: 'a'.repeat(64), duration: 6, width: 720, height: 1280, fps: 30, hasAudio: true }, timeline: {} }
const plan = { title: 't', script: null, theme_id: null, description: 'd', hashtags: [], video_prompt: 'p', music_prompt: 'm', reasoning: 'r', expected_engagement: 'medium' as const, style_override: null, trend_leveraged: null }
const autoInput: AutoJobInput = { userId: 'u', videoRowId: 'v', scheduleId: null, userEmail: null,
  planTier: 'free', generationStartedAt: '2026-10-11T10:00:00Z',
  config: { default_duration: 6, default_aspect_ratio: '9:16', quality_level: '720p', require_approval_before_publish: false } as never }

for (const directory of readdirSync(new URL('../src/app/api/cron/', import.meta.url))) {
  test(`cron ${directory}: secret absent, dev et invalide refusent avant toute operation`, async () => {
    const route = await import(`../src/app/api/cron/${directory}/route.ts`)
    const handler = route.GET ?? route.POST
    assert.equal(typeof handler, 'function')
    delete process.env.CRON_SECRET
    assert.equal((await handler(new Request('https://app.invalid/api/cron/test'))).status, 503)
    process.env.CRON_SECRET = 'dev'
    assert.equal((await handler(new Request('https://app.invalid/api/cron/test', { headers: { authorization: 'Bearer dev' } }))).status, 503)
    process.env.CRON_SECRET = 'valid-test-secret-1234567890'
    assert.equal((await handler(new Request('https://app.invalid/api/cron/test', { headers: { authorization: 'Bearer incorrect' } }))).status, 401)
  })
}

test('cron: secret valide accepte, secret lu a chaque appel', () => {
  process.env.CRON_SECRET = 'valid-secret-A'
  const request = new Request('https://app.invalid', { headers: { authorization: 'Bearer valid-secret-A' } })
  assert.equal(assertCronAuth(request), null)
  process.env.CRON_SECRET = 'valid-secret-B'
  assert.equal(assertCronAuth(request)?.status, 401)
})

test('AUTO: musique sans voix declenche le montage et conserve le branding', async () => {
  let assemblies = 0
  const providers: AutoProviders = { plan: async () => plan,
    assets: async () => ({ video_raw_url: 'raw', audio_music_url: 'music', audio_voice_url: null }),
    assemble: async params => { assemblies++; assert.equal(params.voiceUrl, ''); assert.equal(params.musicUrl, 'music'); assert.equal(params.brandKit?.logo_url, 'logo'); return result },
    persist: async (_input, final) => { assert.equal(final.videoFinalUrl, result.url) } }
  const final = await executeAutoJob({ ...autoInput, config: { ...autoInput.config, watermark_url: 'logo' } }, { steps: {} }, {}, providers)
  assert.equal(final.status, 'ready')
  assert.equal(assemblies, 1)
})

test('AUTO: voix requise manquante bloque ready et efface toute URL finale', async () => {
  let assemblies = 0, persisted = 0
  const providers: AutoProviders = { plan: async () => plan,
    assets: async () => ({ video_raw_url: 'raw', audio_music_url: 'music', audio_voice_url: null }),
    assemble: async () => { assemblies++; return result },
    persist: async (_input, final) => { persisted++; assert.equal(final.status, 'compositing'); assert.equal(final.videoFinalUrl, null) } }
  await assert.rejects(() => executeAutoJob({ ...autoInput, config: { ...autoInput.config, default_voice_enabled: true } }, { steps: {} }, {}, providers), /Voix demandee/)
  assert.equal(assemblies, 0)
  assert.equal(persisted, 1)
})

test('AUTO: musique requise manquante bloque la publication', async () => {
  const providers: AutoProviders = { plan: async () => plan,
    assets: async () => ({ video_raw_url: 'raw', audio_music_url: null, audio_voice_url: null }),
    assemble: async () => { throw new Error('must not render') }, persist: async (_input, final) => { assert.equal(final.videoFinalUrl, null) } }
  await assert.rejects(() => executeAutoJob({ ...autoInput, config: { ...autoInput.config, default_music_genre: 'cinematic' } }, { steps: {} }, {}, providers), /Musique demandee/)
})

test('AUTO: echec de montage transmis au worker, jamais checkpointé comme succes', async () => {
  const steps: Record<string, unknown> = {}
  const providers: AutoProviders = { plan: async () => plan,
    assets: async () => ({ video_raw_url: 'raw', audio_music_url: 'music', audio_voice_url: null }),
    assemble: async () => { throw new Error('render failed') }, persist: async (_input, final) => { assert.equal(final.videoFinalUrl, null) } }
  await assert.rejects(() => executeAutoJob(autoInput, { steps }, {}, providers), /render failed/)
  assert.equal(steps.assembly, undefined)
  assert.equal(steps.saved, undefined)
  await assert.rejects(() => executeAutoJob(autoInput, { steps }, {}, { ...providers, assemble: async () => { throw new Error('MUST_NOT_RESUBMIT') } }), /RECONCILIATION_REQUIRED/)
})

test('EXPORT: resultat cloud non verifie ne peut pas atteindre la sauvegarde ready', async () => {
  let saves = 0
  const input = { videoId: 'v', userId: 'u', quality: '720p', format: '9:16', voiceUrl: '', musicUrl: null, musicVolume: 0.3, requiredTracks: { voice: false, music: false }, clips: [{ url: 'https://media.invalid/source.mp4', type: 'ia' as const, duration: 6 }], subtitles: [] }
  await assert.rejects(() => executeExportJob(input, { steps: {} }, {}, {
    assemble: async () => ({ ...result, outputVerified: false, url: 'https://127.0.0.1/internal.mp4' }),
    persist: async () => { saves++ },
  }), /PRIVATE_ADDRESS/)
  assert.equal(saves, 0)
})

test('AUTO: verification cloud echouee efface URL finale et conserve le rendu deja paye', async () => {
  let assemblies = 0
  const steps: Record<string, unknown> = {}
  const providers: AutoProviders = { plan: async () => plan,
    assets: async () => ({ video_raw_url: 'raw', audio_music_url: null, audio_voice_url: null }),
    assemble: async () => { assemblies++; return { ...result, outputVerified: false, url: 'https://127.0.0.1/private.mp4' } },
    persist: async (_input, final) => { assert.equal(final.status, 'compositing'); assert.equal(final.videoFinalUrl, null) },
  }
  await assert.rejects(() => executeAutoJob(autoInput, { steps }, {}, providers), /PRIVATE_ADDRESS/)
  await assert.rejects(() => executeAutoJob(autoInput, { steps }, {}, providers), /PRIVATE_ADDRESS/)
  assert.equal(assemblies, 1)
  assert.equal(steps.saved, undefined)
})

test('AUTO: ancien checkpoint URL brute sans validation exige reconciliation', async () => {
  const providers: AutoProviders = { plan: async () => plan,
    assets: async () => ({ video_raw_url: 'raw', audio_music_url: null, audio_voice_url: null }),
    assemble: async () => { throw new Error('no render') }, persist: async (_input, final) => { assert.equal(final.videoFinalUrl, null) } }
  await assert.rejects(() => executeAutoJob(autoInput, { steps: { assembly: { url: 'raw', error: null } } }, {}, providers), /RECONCILIATION_REQUIRED/)
})

const productionInput: ProductionJobInput = { step: 'voice', userId: 'u', userEmail: null, userPlan: 'empire', genPlan: 'empire',
  qualityCap: '1080p', mediaFormat: '16:9', idea: 'i', template: null, format: '16:9', voice: null,
  musicStyle: null, tone: null, previousData: { script: { narration: 'voice', scenes: [] } }, brandKit: null, requestKey: 'r' }
const productionProviders: ProductionProviders = { script: async () => { throw new Error('unused') },
  visual: async () => null, voice: async () => new ArrayBuffer(1), music: async () => null,
  assemble: async () => result, upload: async () => 'https://media.invalid/voice.mp3' }

test('VOIX: crash entre morceaux de 24 MiB ne melange pas deux syntheses', async () => {
  let voices = 0, uploads = 0
  const durable: Record<string, unknown> = {}
  const providers: ProductionProviders = { ...productionProviders,
    voice: async () => { voices++; return new Uint8Array(24 * 1024 * 1024).fill(voices).buffer },
    upload: async () => { uploads++; return 'voice' } }
  await assert.rejects(() => executeProductionStep(productionInput, { steps: {} }, {
    onStepResolved: async (key, value) => { if (key === 'voice_b64:1') throw new Error('DB offline'); durable[key] = structuredClone(value) },
  }, providers), /DB offline/)
  await assert.rejects(() => executeProductionStep(productionInput, { steps: structuredClone(durable) }, {}, providers), /morceau 1 manquant/)
  assert.equal(voices, 1)
  assert.equal(uploads, 0)
})

test('VOIX: reponse fournisseur incertaine ne declenche pas de nouvelle synthese', async () => {
  let voices = 0
  const steps: Record<string, unknown> = {}
  const providers = { ...productionProviders, voice: async () => { voices++; throw new Error('connection lost after acceptance') } }
  await assert.rejects(() => executeProductionStep(productionInput, { steps }, {}, providers))
  await assert.rejects(() => executeProductionStep(productionInput, { steps }, {}, providers), /RECONCILIATION_REQUIRED/)
  assert.equal(voices, 1)
})

test('PRODUCTION: une scene manquante interdit le montage raccourci', async () => {
  let assemblies = 0
  const providers = { ...productionProviders, script: async () => ({ ...plan, narration: 'voice', estimated_duration: 6,
    scenes: [{ visual_prompt: 'first', duration_seconds: 3 }, { visual_prompt: 'second', duration_seconds: 3 }] }) as never,
    visual: async (scene: { visual_prompt: string }) => scene.visual_prompt === 'first' ? { url: 'scene1', source: 'ai' as const, engine: 'wan-classic' as const } : null,
    assemble: async () => { assemblies++; return result } }
  await assert.rejects(() => executeProductionStep({ ...productionInput, step: 'all' }, { steps: {} }, {}, providers), /Scene 2 manquante/)
  assert.equal(assemblies, 0)
})

test('SHOTSTACK: apres interruption du polling, reprise par ID sans nouveau POST', async () => {
  process.env.SHOTSTACK_API_KEY = 'isolated-test'
  process.env.SHOTSTACK_ENV = 'stage'
  const steps: Record<string, unknown> = {}
  let submits = 0, polls = 0
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') { submits++; return Response.json({ response: { id: 'remote-1' } }) }
    polls++
    if (polls === 1) throw new Error('poll disconnected')
    return Response.json({ response: { status: 'done', url: result.url, duration: 6 } })
  }
  const params = { clips: [{ url: 'https://media.invalid/clip.mp4', type: 'ia' as const, duration: 6 }], voiceUrl: '', musicUrl: '', musicVolume: 0.3, subtitles: [], transitions: 'fade', format: '9:16', quality: '720p' }
  await assert.rejects(() => assembleFinalVideo({ ...params, renderJob: durableRenderJob(steps) }), /poll disconnected/)
  assert.equal(steps.assembly_render_id, 'remote-1')
  await assembleFinalVideo({ ...params, renderJob: durableRenderJob(steps) })
  assert.equal(submits, 1)
  assert.equal(polls, 2)
})

test('SHOTSTACK: soumission sans ID confirme bloque un second rendu', () => {
  assert.throws(() => durableRenderJob({ assembly_submission_started: true }), /RECONCILIATION_REQUIRED/)
})

test('EXPORT: echec de checkpoint apres rendu conserve ID distant pour la reprise', async () => {
  const durable: Record<string, unknown> = {}
  let submissions = 0
  const input = { videoId: 'v', userId: 'u', quality: '720p', format: '9:16', voiceUrl: '', musicUrl: null, musicVolume: 0.3, requiredTracks: { voice: false, music: false }, clips: [{ url: 'https://media.invalid/source.mp4', type: 'ia' as const, duration: 6 }], subtitles: [] }
  const providers = { validate: async (_url: string, contract: Parameters<typeof simulatedValidation>[0]) => { const value = simulatedValidation(contract); value.final.sha256 = 'a'.repeat(64); return value }, assemble: async (params: Parameters<typeof assembleFinalVideo>[0]) => {
    if (!params.renderJob?.id) { await params.renderJob?.onSubmitting?.(); submissions++; await params.renderJob?.onSubmitted?.('render-1') }
    return result
  }, persist: async () => {} }
  await assert.rejects(() => executeExportJob(input, { steps: {} }, { onStepResolved: async (key, value) => {
    if (key === 'assembly') throw new Error('checkpoint unavailable')
    durable[key] = structuredClone(value)
  } }, providers), /checkpoint unavailable/)
  await executeExportJob(input, { steps: structuredClone(durable) }, {}, providers)
  assert.equal(submissions, 1)
})

test('PLANNING: deux horaires proches et un passage tardif restent enumeres', () => {
  const base = { name: 's', is_active: true, frequency: 'daily' as const, days: [], timezone: 'UTC' }
  const schedules = [{ ...base, id: 'a', time: '10:15' }, { ...base, id: 'b', time: '10:45' }]
  assert.deepEqual(autoOccurrences(schedules, new Date('2026-10-11T09:16:00Z'), new Date('2026-10-11T13:16:00Z')).map(v => v.schedule.id), ['a', 'b'])
  assert.equal(autoOccurrences([...schedules, schedules[0]], new Date('2026-10-11T09:16:00Z'), new Date('2026-10-11T13:16:00Z')).length, 2)
})

test('QUEUE: erreurs RPC et finalisation sans ligne ne sont jamais des succes', async () => {
  globalThis.fetch = async () => Response.json({ message: 'database unavailable', code: 'XX000' }, { status: 503 })
  for (const operation of [() => queue.checkpoint('j', 'w', {}), () => queue.heartbeat('j', 'w'),
    () => queue.completeQuota('u'), () => queue.releaseQuota('u'), () => queue.getJobByKey('k'), () => queue.finishJob('j', 'w', 'done')]) {
    await assert.rejects(operation)
  }
})

test('QUEUE: cle dupliquee conserve statut et acquis; changement de payload refuse', async () => {
  const job = { id: 'j', video_id: null, user_id: 'u', kind: 'auto', payload: { input: 'same' }, status: 'done', progress: { steps: { paid: true } } }
  globalThis.fetch = async (_url, init) => {
    if (init?.method === 'POST') {
      assert.match(new Headers(init.headers).get('prefer') ?? '', /resolution=ignore-duplicates/)
      return Response.json([])
    }
    return Response.json([job])
  }
  const params = { videoId: null, userId: 'u', kind: 'auto' as const, payload: { input: 'same' }, idempotencyKey: 'key' }
  assert.equal((await queue.enqueueJob(params)).status, 'done')
  await assert.rejects(() => queue.enqueueJob({ ...params, payload: { input: 'different' } }), /IDEMPOTENCY_CONFLICT/)
})

import { socialDatabase, accountId as verifiedAccount, postId as publicationPostId } from './helpers/social-database.mts'
function publicationDatabase(status = 'ready', failClaim = false, failSave = false, verified = true) {
  const db = socialDatabase()
  db.auto.status = status; db.settings.failClaim = failClaim; db.settings.failFinal = failSave
  db.accounts.splice(1)
  if (!verified) db.tables.video_jobs.length = 0
  return { ...db, video: db.auto }
}

test('PUBLICATION: video annulee refusee avant appel externe', async () => {
  let calls = 0
  const db = publicationDatabase('cancelled')
  await assert.rejects(() => publishAutoVideoRecord('u', 'v', true, db.client, async () => { calls++; return [] }))
  assert.equal(calls, 0)
})
test('PUBLICATION AUTO: ancien ready sans checkpoint du fichier verifie ne publie rien', async () => {
  let calls = 0; const db = publicationDatabase('ready', false, false, false)
  await assert.rejects(() => publishAutoVideoRecord('u', 'v', true, db.client, async () => { calls++; return [] }), /MEDIA_VERIFICATION_REQUIRED/)
  assert.equal(calls, 0)
})

test('PUBLICATION: succes partiel reste partiel et comptes issus du serveur', async () => {
  const db = publicationDatabase()
  const actual = await publishAutoVideoRecord('u', 'v', true, db.client, async params => {
    assert.equal(params.config.zernio_connected_platforms[0].account_id, verifiedAccount)
    return [{ platform: 'youtube' as const, success: true, status: 'published' as const, postId: publicationPostId }]
  })
  assert.equal(actual.status, 'partially_published')
  assert.equal(actual.success, false)
})

test('PUBLICATION: deux requetes concurrentes ne soumettent qu une fois', async () => {
  const db = publicationDatabase()
  let calls = 0
  const publish = async () => { calls++; return [{ platform: 'youtube' as const, success: true, status: 'published' as const, postId: publicationPostId }] }
  const outcomes = await Promise.allSettled([publishAutoVideoRecord('u', 'v', true, db.client, publish), publishAutoVideoRecord('u', 'v', true, db.client, publish)])
  assert.equal(calls, 1)
  assert.ok(outcomes.some(value => value.status === 'fulfilled'))
})

test('PUBLICATION: echec reservation ne contacte pas le fournisseur', async () => {
  const db = publicationDatabase('ready', true)
  let calls = 0
  await assert.rejects(() => publishAutoVideoRecord('u', 'v', true, db.client, async () => { calls++; return [] }), /CLAIM_FAILED/)
  assert.equal(calls, 0)
})

test('PUBLICATION: resultat non enregistre exige reconciliation et bloque le rejeu', async () => {
  const db = publicationDatabase('ready', false, true)
  let calls = 0
  const publish = async () => { calls++; return [{ platform: 'youtube' as const, success: true, status: 'published' as const, postId: publicationPostId }] }
  await assert.rejects(() => publishAutoVideoRecord('u', 'v', true, db.client, publish), /RECONCILIATION_REQUIRED/)
  assert.equal(db.tables.social_publication_journals[0].operations[0].phase, 'submitting')
  db.settings.failFinal = false
  await publishAutoVideoRecord('u', 'v', true, db.client, publish)
  assert.equal(calls, 1)
})

const { withPipelineLease } = await import('../src/lib/pipeline-state.ts')

test('PERSISTENCE: toute ecriture finale exige bail et accuse RPC strict', async () => {
  const assembled = { url: result.url, quality: '720p', duration: 6 }
  for (const data of [false, null]) {
    const client = { rpc: async () => ({ data, error: null }) } as never
    await assert.rejects(() => withPipelineLease('j','w', () => persistProductionResult('j','assembly',assembled,{},productionInput,client)), /PERSISTENCE_FAILED/)
    const input = { videoId: 'v', userId: 'u', quality: '720p', format: '9:16', voiceUrl: '', musicUrl: null, musicVolume: 0.3, requiredTracks: { voice: false, music: false }, clips: [{ url: 'https://media.invalid/source.mp4', type: 'ia' as const, duration: 6 }], subtitles: [] }
    await assert.rejects(() => withPipelineLease('j','w', () => persistExportResult(input,{video_url: result.url,quality:'720p',duration:6},client)), /PERSISTENCE_FAILED/)
  }
  await assert.rejects(() => persistProductionResult('j','assembly',assembled,{},productionInput,{} as never), /LEASE_REQUIRED/)
})

test('QUOTA: confirmation done est une lecture, jamais un second settlement', async () => {
  let reads = 0
  globalThis.fetch = async (_url, options) => {
    assert.ok(!options?.method || options.method === 'GET')
    reads++
    return Response.json({ status: 'done' })
  }
  assert.equal(await queue.completeQuotaForFinishedJob('u','j'), true)
  assert.equal(reads,1)
})
