// Script de test : compteurs d'appels, sorties lisibles.
/* eslint-disable no-console */
// -----------------------------------------------------------------------------
// Files durables AUTO + EXPORT — interruption / reprise SANS double génération
// ni double débit (+ voix >5 Mo checkpointée).
//
// Fournisseurs INJECTÉS (aucun réseau, aucune clé) : chaque doublure COMPTE
// ses appels — les garanties sont prouvées aux compteurs cumulés.
//
//   node --import tsx --test scripts/test-auto-export-queue.mts
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-ref.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.NEXT_PUBLIC_APP_SCHEMA ??= 'sutra'

const { executeExportJob } = await import('../src/lib/export-pipeline.ts')
const { executeAutoJob } = await import('../src/lib/auto-pipeline.ts')
const { executeProductionStep } = await import('../src/lib/production-pipeline.ts')
import type { ExportJobInput, ExportProviders } from '../src/lib/export-pipeline.ts'
import type { AutoJobInput, AutoProviders, AutoAssets } from '../src/lib/auto-pipeline.ts'
import type { ProductionJobInput, ProductionProviders } from '../src/lib/production-pipeline.ts'

type Steps = Record<string, unknown>

/** Le resume EST l'objet suivi : ses mutations = checkpoints réels. */
async function run<T>(fn: (resume: { steps: Steps }) => Promise<T>): Promise<{ ok: true; result: T; steps: Steps } | { ok: false; error: string; steps: Steps }> {
  const steps: Steps = {}
  try {
    const result = await fn({ steps })
    return { ok: true, result, steps }
  } catch (err) {
    return { ok: false, error: (err as Error).message, steps }
  }
}

// --- EXPORT --------------------------------------------------------------------
test('EXPORT : crash pendant le rendu → reprise SANS re-rendu de l\'acquis', async () => {
  let assembleCalls = 0
  let persistCalls = 0
  let failOnce = true
  const providers: ExportProviders = {
    assemble: async () => {
      assembleCalls++
      if (failOnce) throw new Error('RENDU INTERROMPU (worker tue chez Shotstack)')
      return { url: 'https://storage.test/export.mp4', duration: 30, outputQuality: 'hd' as const, outputSize: { width: 1920, height: 1080 }, timeline: {} }
    },
    persist: async (_input, update) => {
      persistCalls++
      assert.equal(update.video_url, 'https://storage.test/export.mp4')
    },
  }
  const input: ExportJobInput = {
    videoId: 'v1', userId: 'u1', quality: '1080p', format: '16:9',
    voiceUrl: 'https://storage.test/voice.mp3', musicUrl: null, musicVolume: 0.3,
    clips: [{ url: 'https://storage.test/scene.mp4', type: 'ia', kind: 'video', duration: 30 }],
    subtitles: [],
  }

  // 1. Interruption pendant le rendu payant.
  const run1 = await run((resume) => executeExportJob(input, resume, {}, providers))
  assert.equal(run1.ok, false)
  assert.match(run1.error, /RENDU INTERROMPU/)
  assert.equal(assembleCalls, 1, 'un seul appel tué en vol')
  assert.equal(persistCalls, 0)

  // 2. Reprise : le rendu est retenté (rien n'était acquis), puis persist UNE fois.
  failOnce = false
  const run2 = await run((resume) => executeExportJob(input, { steps: Object.assign(resume.steps, run1.steps) }, {}, providers))
  assert.equal(run2.ok, true, 'reprise aboutit')
  assert.equal((run2.result as { url: string }).url, 'https://storage.test/export.mp4')
  assert.equal(assembleCalls, 2, 'rendu : appel tué + reprise, jamais 3')
  assert.equal(persistCalls, 1, 'persistance exactement une fois')

  // 3. RE-REPRISE depuis les checkpoints complets : PLUS AUCUN appel.
  const run3 = await run((resume) => executeExportJob(input, { steps: Object.assign(resume.steps, run2.steps) }, {}, providers))
  assert.equal(run3.ok, true)
  assert.equal(assembleCalls, 2, 'acquis complet → 0 re-rendu')
  assert.equal(persistCalls, 1, '0 re-persistance')
  console.log('✓ export : interruption→reprise sans double rendu, re-reprise 100% en cache')
})

// --- AUTO ----------------------------------------------------------------------
test('AUTO : crash pendant les assets → plan conservé, assets/assemblage une seule fois', async () => {
  let planCalls = 0, assetsCalls = 0, assembleCalls = 0, persistCalls = 0
  let failAssetsOnce = true
  const PLAN = {
    title: 'Routine matin', theme_id: 'theme-1', description: 'd', hashtags: ['#h'],
    script: 'Texte narration.', video_prompt: 'prompt', music_prompt: 'm',
    reasoning: 'r', expected_engagement: 'high',
  }
  const providers: AutoProviders = {
    plan: async () => { planCalls++; return structuredClone(PLAN) as never },
    assets: async () => {
      assetsCalls++
      if (failAssetsOnce) throw new Error('GENERATION INTERROMPUE (worker tue pendant RunPod)')
      return { video_raw_url: 'https://storage.test/raw.mp4', audio_music_url: 'm', audio_voice_url: 'v' } satisfies AutoAssets
    },
    assemble: async () => { assembleCalls++; return { url: 'https://storage.test/final.mp4', duration: 6, outputQuality: 'hd' as const, outputSize: { width: 1080, height: 1920 }, timeline: {} } },
    persist: async (_input, final) => { persistCalls++; assert.equal(final.status, 'ready') },
  }
  const input: AutoJobInput = {
    userId: 'u1', videoRowId: 'row1', scheduleId: null, userEmail: null, planTier: 'empire',
    config: { default_duration: 6, default_aspect_ratio: '9:16', quality_level: '720p', require_approval_before_publish: false } as never,
    generationStartedAt: new Date().toISOString(),
  }

  const run1 = await run((resume) => executeAutoJob(input, resume, {}, providers))
  assert.equal(run1.ok, false)
  assert.match(run1.error, /GENERATION INTERROMPUE/)
  assert.equal(planCalls, 1)
  assert.ok(run1.steps.plan, 'plan (LLM) checkpointé — jamais réexécuté')

  failAssetsOnce = false
  const run2 = await run((resume) => executeAutoJob(input, { steps: Object.assign(resume.steps, run1.steps) }, {}, providers))
  assert.equal(run2.ok, true, 'reprise aboutit')
  assert.equal((run2.result as { status: string }).status, 'ready')
  assert.equal(planCalls, 1, 'plan : JAMAIS replanifié')
  assert.equal(assetsCalls, 2, 'assets : appel tué + reprise, jamais 3')
  assert.equal(assembleCalls, 1, 'montage : une seule fois')
  assert.equal(persistCalls, 1, 'persistance une fois')
  console.log('✓ auto : crash assets → plan conservé, chaque étape payée une fois au total')
})

// --- AUTO compositing_failed ---------------------------------------------------
test('AUTO : échec de montage → vidéo brute conservée, statut compositing_failed', async () => {
  let assembleCalls = 0
  const providers: AutoProviders = {
    plan: async () => ({ title: 't', theme_id: null, script: 's', reasoning: 'r', expected_engagement: 'medium' }) as never,
    assets: async () => ({ video_raw_url: 'raw', audio_music_url: null, audio_voice_url: 'v' }) as never,
    assemble: async () => { assembleCalls++; throw new Error('Shotstack down') },
    persist: async (_i, final) => { assert.equal(final.status, 'compositing_failed'); assert.equal(final.videoFinalUrl, 'raw') },
  }
  const input: AutoJobInput = {
    userId: 'u', videoRowId: 'r', scheduleId: null, userEmail: null, planTier: 'free',
    config: { require_approval_before_publish: true } as never,
    generationStartedAt: new Date().toISOString(),
  }
  const res = await executeAutoJob(input, { steps: {} }, {}, providers)
  assert.equal(res.status, 'compositing_failed')
  assert.equal(assembleCalls, 1)
  console.log('✓ auto : échec montage tracé (compositing_failed), pas de statut mensonger')
})

// --- VOIX >5 Mo checkpointée (production) --------------------------------------
test('VOIX >5 Mo : buffer checkpointé — interruption ne régénère PAS la voix', async () => {
  let voiceCalls = 0, uploadCalls = 0
  let failUploadOnce = true
  // 7 Mo de voix (narration longue) — au-dessus de l'ancien seuil de 5 Mo.
  const bigVoice = new Uint8Array(7 * 1024 * 1024).fill(65)
  const providers: ProductionProviders = {
    script: async () => { throw new Error('inutilise ici') },
    visual: async () => null,
    voice: async () => { voiceCalls++; return bigVoice.slice().buffer as ArrayBuffer },
    music: async () => null,
    assemble: async () => { throw new Error('inutilise ici') },
    upload: async () => {
      uploadCalls++
      if (failUploadOnce) throw new Error('crash avant upload')
      return 'https://storage.test/voice-longue.mp3'
    },
  }
  const input: ProductionJobInput = {
    step: 'voice', userId: 'u', userEmail: null, userPlan: 'empire', genPlan: 'empire',
    qualityCap: '1080p', mediaFormat: '16:9', idea: 'i', template: null, format: null,
    voice: null, musicStyle: null, tone: null,
    previousData: { script: { narration: 'narration longue', scenes: [] } },
    brandKit: null, requestKey: 'req-long',
  }
  const steps: Steps = {}
  const track = { onStepResolved: async (k: string, v: unknown) => { steps[k] = v } }
  const run1 = await run(() => executeProductionStep(input, { steps }, track, providers))
  assert.equal(run1.ok, false)
  assert.match(run1.error, /crash avant upload/)
  assert.ok(steps.voice_b64, 'voix 7 Mo CHECKPOINTÉE (plus de trou >5 Mo)')
  assert.ok((steps.voice_b64 as string).length > 5 * 1024 * 1024, 'taille base64 cohérente avec 7 Mo')

  failUploadOnce = false
  const resumed = await executeProductionStep(input, { steps: { ...steps } }, {}, providers) as { url: string }
  assert.equal(resumed.url, 'https://storage.test/voice-longue.mp3')
  assert.equal(voiceCalls, 1, 'voix 7 Mo : UNE SEULE synthèse au total')
  assert.equal(uploadCalls, 2, 'upload retenté (gratuit)')
  console.log('✓ voix 7 Mo : checkpointée et jamais resynthétisée après interruption')
})
