// Script de parcours réel : fichiers locaux produits et mesurés via ffprobe.
/* eslint-disable no-console */
// -----------------------------------------------------------------------------
// PARCOURS COMPLET moteur local — VRAI fichier, mesuré, AUCUN appel payant.
//
// Autonome : démarre lui-même le stub (scripts/local-engine-stub-server.mjs,
// ffmpeg requis) puis exécute le parcours. Exécution :
//   node --import tsx --test scripts/test-local-engine-e2e.mts
//
// Garantie anti-frais : un wrapper fetch enregistre CHAQUE hôte contacté et
// fait échouer le test si un seul n'est pas 127.0.0.1 — aucune API externe,
// donc aucun repli payant possible, en aucun scénario.
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const run = promisify(execFile)

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-ref.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.NEXT_PUBLIC_APP_SCHEMA ??= 'sutra'

const STUB = 'http://127.0.0.1:7861'
const OWNER = 'matiss.frasne@gmail.com' // super-admin de référence (utils.ts)

// --- garde anti-appel-externe -------------------------------------------------
const touchedHosts = new Set<string>()
const realFetch = globalThis.fetch
;(globalThis as Record<string, unknown>).fetch = (url: string | URL, init?: RequestInit) => {
  const host = new URL(String(url)).host
  touchedHosts.add(host)
  if (!host.startsWith('127.0.0.1')) {
    throw new Error(`APPEL EXTERNE INTERDIT en mode test : ${host} — un repli payant a été tenté`)
  }
  return realFetch(url, init)
}
const assertNoExternalCall = () => {
  for (const h of touchedHosts) assert.match(h, /^127\.0\.0\.1/, `hôte externe contacté : ${h}`)
}

const { generateVideoSmart } = await import('../src/lib/ltx.ts')
const { getWanDimensions } = await import('../src/lib/wan.ts')

// --- stub autonome : démarré ici, arrêté à la fin ------------------------------
const stubProc = spawn(
  process.execPath,
  [join(import.meta.dirname, 'local-engine-stub-server.mjs'), '7861'],
  { stdio: 'ignore' }
)
{
  let ready = false
  for (let i = 0; i < 40 && !ready; i++) {
    try {
      const res = await realFetch(`${STUB}/health`, { signal: AbortSignal.timeout(500) })
      ready = res.ok
    } catch {
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  if (!ready) {
    stubProc.kill()
    throw new Error('stub moteur local non prêt après 10s (ffmpeg installé ?)')
  }
}
test.after(() => stubProc.kill())

interface FfprobeStream {
  codec_type: string
  codec_name: string
  width?: number
  height?: number
  duration?: string
  r_frame_rate?: string
}
interface FfprobeResult {
  streams: FfprobeStream[]
  format: { duration: string }
}

test('parcours local COMPLET : génération → fichier réel → mesures ffprobe', async () => {
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = STUB
  process.env.LOCAL_ENGINE_MODE = 'strict'

  // Propriétaire, plan empire : SANS le moteur local ce serait du LTX payant.
  // La garde anti-externe prouve que le routage est resté 100 % local.
  const t0 = Date.now()
  const result = await generateVideoSmart(
    'un phare dans la tempete, cinematic',
    'empire',
    OWNER,
    { format: '16:9', quality: '720p', duration: 6 }
  )
  const wallMs = Date.now() - t0

  assert.equal(result.model, 'local-m4max', 'la génération vient du moteur local')
  assert.ok(result.videoBuffer.byteLength > 10_000, 'fichier vidéo substantiel')

  // Fichier RÉEL écrit puis lu par ffprobe (mesures indépendantes du code).
  const outDir = mkdtempSync(join(tmpdir(), 'sutra-local-e2e-'))
  const file = join(outDir, 'local.mp4')
  writeFileSync(file, Buffer.from(result.videoBuffer))
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
    ])
    const probe = JSON.parse(stdout) as FfprobeResult

    const video = probe.streams.find((s) => s.codec_type === 'video')
    const audio = probe.streams.find((s) => s.codec_type === 'audio')
    assert.ok(video, 'piste vidéo présente')
    assert.ok(audio, 'piste AUDIO présente (génération locale avec son)')
    assert.equal(video!.codec_name, 'h264')
    assert.equal(audio!.codec_name, 'aac')

    // Résolution demandée : la grille WAN (le moteur local calque ses
    // dimensions sur la route wan-classic) — le fichier doit être EXACT.
    const dims = getWanDimensions('720p', '16:9')
    assert.equal(video!.width, dims.width, `largeur attendue ${dims.width}, mesurée ${video!.width}`)
    assert.equal(video!.height, dims.height, `hauteur attendue ${dims.height}, mesurée ${video!.height}`)

    // Durée demandée : 6 s (tolérance conteneur ±0.3 s)
    const duration = Number(probe.format.duration)
    assert.ok(Math.abs(duration - 6) <= 0.3, `durée attendue ~6s, mesurée ${duration}s`)

    // Synchronisation audio/vidéo : les deux pistes durent pareil (±0.25 s)
    const vDur = Number(video!.duration ?? probe.format.duration)
    const aDur = Number(audio!.duration ?? probe.format.duration)
    assert.ok(
      Math.abs(vDur - aDur) <= 0.25,
      `désynchronisation A/V : vidéo ${vDur}s vs audio ${aDur}s`
    )

    // Rapport de provenance HONNÊTE : le « modèle » 'local-m4max' est le nom
    // logique du ROUTEUR ; le PRODUCTEUR réel de ce fichier est le stub de
    // test (ffmpeg testsrc2 + sine), PAS un modèle d'inférence IA.
    const fps = video!.r_frame_rate ? Number(video!.r_frame_rate.split('/')[0]) / Number(video!.r_frame_rate.split('/')[1] || 1) : NaN
    console.log(`✓ fichier local mesuré : natif ${video!.width}×${video!.height} @ ${fps.toFixed(0)} fps → final identique (aucun crop/montage dans ce parcours mono-clip), ${duration.toFixed(2)}s, h264+aac, A/V Δ=${Math.abs(vDur - aDur).toFixed(3)}s`)
    console.log(`  temps de calcul (parcours complet POST+ffmpeg+téléchargement) : ${wallMs} ms`)
    console.log('  génération IA réelle : NON — fichier de TEST produit par ffmpeg (stub), le moteur d\'inférence M4 Max reste à brancher/benchmarker')
    assertNoExternalCall()
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
})

test('mode STRICT : moteur local éteint → erreur explicite, ZÉRO appel externe', async () => {
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = 'http://127.0.0.1:7899' // rien n'écoute ici
  process.env.LOCAL_ENGINE_MODE = 'strict'

  await assert.rejects(
    () => generateVideoSmart('test', 'empire', OWNER, { format: '16:9', quality: '720p', duration: 6 }),
    /Moteur local indisponible \(mode strict/
  )
  // La preuve anti-frais : échouer n'a déclenché AUCUN hôte externe.
  assertNoExternalCall()
})

test('routage local : un CLIENT ne part jamais sur le Mac du propriétaire', async () => {
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = STUB
  process.env.LOCAL_ENGINE_MODE = 'strict'
  // Un client (email non propriétaire) : tryLocalRoute doit refuser AVANT tout
  // appel réseau — on le vérifie sans lancer de génération externe.
  const { shouldUseLocalEngine } = await import('../src/lib/local-engine.ts')
  assert.equal(shouldUseLocalEngine('client@example.test'), false)
  assert.equal(shouldUseLocalEngine(OWNER), true)
})
