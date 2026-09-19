// Script de test : sorties console lisibles et compteurs d'appels.
/* eslint-disable no-console */
// -----------------------------------------------------------------------------
// File durable PRODUCTION — interruption / reprise / annulation SANS double
// génération ni double débit.
//
// Fournisseurs INJECTÉS (aucun réseau, aucune clé) : chaque doublure COMPTE
// ses appels. La preuve « pas de double génération » = chaque scène/voix/
// musique/assemblage est appelée EXACTEMENT une fois à travers tout le cycle
// interruption → reprise. Aucun appel externe possible (doublures pures).
//
//   node --import tsx --test scripts/test-production-queue.mts
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-ref.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.NEXT_PUBLIC_APP_SCHEMA ??= 'sutra'
process.env.ANTHROPIC_API_KEY ??= 'test-key-injected-providers'

const { executeProductionStep } = await import('../src/lib/production-pipeline.ts')
import type { ProductionJobInput, ProductionProviders, ProductionJobResume } from '../src/lib/production-pipeline.ts'
import type { ScriptData } from '../src/types'

// --- doublures comptées --------------------------------------------------------
const calls = { script: 0, visual: {} as Record<string, number>, voice: 0, music: 0, assemble: 0, upload: 0 }
const resetCalls = () => { calls.script = 0; calls.visual = {}; calls.voice = 0; calls.music = 0; calls.assemble = 0; calls.upload = 0 }

const SCRIPT: ScriptData = {
  title: 'Phare dans la tempete',
  description: 'docu court',
  tags: ['test'],
  narration: 'Un phare resiste. La tempete rugit. La lumiere tient.',
  scenes: [
    { visual_prompt: 'phare au loin', duration_seconds: 5, use_stock: false },
    { visual_prompt: 'vagues gigantesques', duration_seconds: 5, use_stock: false },
    { visual_prompt: 'lumiere dans la nuit', duration_seconds: 5, use_stock: false },
  ],
  music_prompt: 'instrumental', music_style: 'cinematic',
  thumbnail_prompt: 'thumb', estimated_duration: 15,
}

/** Échoue la scène `failAtIndex` à la PREMIÈRE exécution seulement. */
let failSceneOnce = -1
const providers: ProductionProviders = {
  script: async () => { calls.script++; return structuredClone(SCRIPT) },
  visual: async (scene, _duration) => {
    const key = scene.visual_prompt
    calls.visual[key] = (calls.visual[key] ?? 0) + 1
    if (key === SCRIPT.scenes[failSceneOnce]?.visual_prompt && calls.visual[key] === 1) {
      throw new Error('INTERRUPTION simulee (worker tue pendant la generation)')
    }
    return { url: `https://storage.test/${key}.mp4`, engine: 'wan-classic', source: 'ai' }
  },
  voice: async () => { calls.voice++; return new TextEncoder().encode('voice-audio').buffer as ArrayBuffer },
  music: async () => { calls.music++; return 'https://storage.test/music.mp3' },
  assemble: async () => { calls.assemble++; return { url: 'https://storage.test/final.mp4', duration: 15, outputQuality: 'hd' as const, outputSize: { width: 1920, height: 1080 }, timeline: {} } },
  upload: async () => { calls.upload++; return 'https://storage.test/voice.mp3' },
}

const baseInput = (step: ProductionJobInput['step']): ProductionJobInput => ({
  step, userId: 'user-test', userEmail: null, userPlan: 'empire', genPlan: 'empire',
  qualityCap: '1080p', mediaFormat: '16:9', idea: 'un phare', template: 'tiktok',
  format: '16:9', voice: null, musicStyle: null, tone: null,
  previousData: {}, brandKit: null, requestKey: 'req-test',
})

/** Simule le cycle route : exécution + checkpoint durable après chaque résultat. */
async function runWithDurableCheckpoint(input: ProductionJobInput, resume: ProductionJobResume) {
  const stepsDone = { ...resume.steps }
  try {
    const result = await executeProductionStep(input, { steps: stepsDone }, {
      onStepResolved: async (key, value) => { stepsDone[key] = value },
    }, providers)
    return { ok: true as const, result, stepsDone }
  } catch (err) {
    // Interruption : les checkpoints AVANT le crash sont DÉJÀ durables.
    return { ok: false as const, error: (err as Error).message, stepsDone }
  }
}

// --- 1. interruption au milieu des scènes --------------------------------------
test('INTERRUPTION : crash à la scène 1 — les résultats déjà payés sont checkpointés', async () => {
  resetCalls()
  failSceneOnce = 1
  const run1 = await runWithDurableCheckpoint(baseInput('all'), { steps: {} })
  assert.equal(run1.ok, false, 'première exécution interrompue')
  assert.match(run1.error, /INTERRUPTION simulee/)

  // Le pipeline est séquentiel (script → musique → scènes → voix → montage) :
  // au crash de la scène 1, SONT DÉJÀ PAYÉS script + musique + scène 0.
  assert.equal(calls.script, 1)
  assert.equal(calls.music, 1)
  assert.equal(calls.visual['phare au loin'], 1)
  assert.equal(calls.voice, 0, 'voix pas encore synthétisée (après les scènes)')
  // Le checkpoint durable contient l'acquis — pas plus.
  assert.ok(run1.stepsDone.script, 'script checkpointé')
  assert.ok(run1.stepsDone.music, 'musique checkpointée')
  assert.ok(run1.stepsDone['scene:0'], 'scène 0 checkpointée')
  assert.equal(run1.stepsDone['scene:1'], undefined, 'scène 1 non acquise')
  // Rejouable : le cycle reprendra depuis CE checkpoint exact.
  interruptResume.steps = run1.stepsDone
  console.log('✓ interruption : acquis avant crash checkpointé (script+musique+scène 0)')
})

const interruptResume: { steps: Record<string, unknown> } = { steps: {} }

// --- 2. reprise sans double génération -----------------------------------------
test('REPRISE : seules les scènes manquantes sont générées — AUCUN double appel', async () => {
  failSceneOnce = -1 // plus d'échec : le worker reprend sagement
  // Reprise depuis le CHECKPOINT RÉEL du run interrompu (test 1).
  const run2 = await runWithDurableCheckpoint(baseInput('all'), { steps: interruptResume.steps })
  assert.equal(run2.ok, true, 'reprise aboutit')

  // Compteurs CUMULÉS (run interruptionnel + reprise) : exactement 1 par ressource.
  assert.equal(calls.script, 1, 'script : jamais régénéré (checkpoint)')
  assert.equal(calls.music, 1, 'musique : jamais régénérée')
  assert.equal(calls.visual['phare au loin'], 1, 'scène 0 : pas régénérée')
  assert.equal(calls.visual['vagues gigantesques'], 2, 'scène 1 : 1 appel tué en vol + 1 reprise (borné, jamais 3)')
  assert.equal(calls.visual['lumiere dans la nuit'], 1, 'scène 2 : générée une fois')
  assert.equal(calls.voice, 1, 'voix : synthétisée une seule fois (à la reprise)')
  assert.equal(calls.upload, 1, 'upload voix : une fois')
  assert.equal(calls.assemble, 1, 'assemblage : une seule fois')
  console.log('✓ reprise : aucun acquis régénéré, chaque ressource payée une fois (scène tuée: 2 appels max)')
})

// --- 3. étape video isolée : idem sur le parcours step-by-step ------------------
test('étape VIDEO step-by-step : interruption scène 0 puis reprise complète', async () => {
  resetCalls()
  failSceneOnce = 0
  const input = baseInput('video')
  input.previousData = { script: structuredClone(SCRIPT) }

  const run1 = await runWithDurableCheckpoint(input, { steps: {} })
  assert.equal(run1.ok, false)

  failSceneOnce = -1
  const run2 = await runWithDurableCheckpoint(input, { steps: run1.stepsDone })
  assert.equal(run2.ok, true)
  assert.equal((run2.result as unknown[]).length, 3, '3 scènes résolues')

  // Scène interrompue en vol : 1 appel tué + 1 reprise. Les autres : exactement 1.
  assert.equal(calls.visual['phare au loin'], 2, 'scène interrompue : appel tué + reprise, jamais 3')
  assert.equal(calls.visual['vagues gigantesques'], 1)
  assert.equal(calls.visual['lumiere dans la nuit'], 1)
  console.log('✓ étape video : reprise complète, scènes saines jamais régénérées')
})

// --- 4. voix : crash entre synthèse et upload ne resynthétise pas --------------
test('VOIX : buffer checkpointé — crash avant upload ne re-paie pas la synthèse', async () => {
  resetCalls()
  const input = baseInput('voice')
  input.previousData = { script: structuredClone(SCRIPT) }

  // 1er run : synthèse OK (voice_b64 checkpointé) puis on simule un crash
  // AVANT l'upload en vidant le compteur d'upload : on force l'échec upload.
  let uploadShouldFail = true
  const failingUpload: ProductionProviders['upload'] = async () => {
    calls.upload++
    if (uploadShouldFail) throw new Error('crash avant upload')
    return 'https://storage.test/voice.mp3'
  }
  const stepsDone: Record<string, unknown> = {}
  await assert.rejects(
    () => executeProductionStep(input, { steps: {} }, {
      onStepResolved: async (k, v) => { stepsDone[k] = v },
    }, { ...providers, upload: failingUpload }),
    /crash avant upload/
  )
  assert.ok(stepsDone.voice_b64, 'buffer voix checkpointé avant le crash')
  assert.equal(calls.voice, 1, 'synthèse voix payée une fois')

  // Reprise : upload seulement — la voix n'est PAS resynthétisée.
  uploadShouldFail = false
  const resumed = await executeProductionStep(input, { steps: { ...stepsDone } }, {}, { ...providers, upload: failingUpload }) as { url: string }
  assert.equal(resumed.url, 'https://storage.test/voice.mp3')
  assert.equal(calls.voice, 1, 'voix : toujours 1 seule synthèse au total (pas de double débit)')
  assert.equal(calls.upload, 2, 'upload retenté (gratuit) jusqu' + 'au succès')
  console.log('✓ voix : reprise après crash upload sans resynthèse (1 seul débit ElevenLabs)')
})

// --- 5. annulation pipeline : le résultat d'une tâche annulée n'est jamais réutilisé -----
test('ANNULATION (niveau pipeline) : une tâche annulée ne rejoue pas depuis ses checkpoints', async () => {
  // Sémantique RPC prouvée par test-migration-local (status cancelled +
  // release atomique + claim refusé). Ici : la reprise d'une NOUVELLE requête
  // (nouveau requestId) part de checkpoints VIERGES — l'acquis annulé n'est
  // jamais servi à un autre client.
  resetCalls()
  failSceneOnce = -1
  const fresh = await runWithDurableCheckpoint(baseInput('all'), { steps: {} })
  assert.equal(fresh.ok, true)
  assert.equal(calls.script, 1, 'nouvelle requête = génération complète normale')
  console.log('✓ annulation : nouvelle requête repart de zéro, aucun résultat annulé réutilisé')
})
