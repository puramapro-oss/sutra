/**
 * SUTRA - Mode autonome — Orchestrateur
 * ----------------------------------------------------------------
 * Orchestre la planification, la generation et la publication
 * automatiques de videos selon les preferences utilisateur.
 *
 * Pipeline:
 *   plan → generate (video + audio) → composite → publish → learn
 */

import { smarana } from '@purama/smarana'
import { z } from 'zod'
import { generateVideoSmart, durableLtxJob, type LtxJobState } from '@/lib/ltx'
import { generateMusic } from '@/lib/suno'
import { generateVoice } from '@/lib/elevenlabs'
import { uploadToStorage } from '@/lib/storage'
import { pipelineSteps } from '@/lib/pipeline-state'
import { musicCheckpointed } from '@/lib/music-checkpoint'
import { voiceB64Checkpointed } from '@/lib/production-pipeline'
import type { Plan } from '@/types'

// Re-export types from dedicated modules
export type {
  AutoConfig,
  AutoSchedule,
  AutoTheme,
  AutoMemory,
  AutoVideoRecord,
  VideoPlan,
} from './sutra-auto-types'

// Re-export utils
export { computeNextRun, needsFinalComposition, pickTheme } from './sutra-auto-utils'
export { analyzePerformance, loadAutoContext, recordMemory } from './sutra-auto-helpers'

// Import for local use
import type { AutoConfig, AutoTheme, AutoMemory, AutoVideoRecord, VideoPlan } from './sutra-auto-types'

const videoPlanSchema = z.object({
  title: z.string().trim().min(3).max(60),
  description: z.string().trim().min(10).max(3000),
  hashtags: z.array(z.string().trim().regex(/^#/)).min(3).max(15),
  video_prompt: z.string().trim().min(30).max(3000),
  music_prompt: z.string().trim().min(10).max(1000),
  script: z.string().trim().min(10).max(10000).nullable(),
  style_override: z.string().trim().max(100).nullable(),
  theme_id: z.string().uuid().nullable(),
  reasoning: z.string().trim().min(10).max(2000),
  expected_engagement: z.enum(['high', 'medium', 'low']),
  trend_leveraged: z.string().trim().max(300).nullable(),
})

function parseVideoPlan(raw: string): VideoPlan {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  let value: unknown
  try {
    value = JSON.parse(cleaned)
  } catch {
    throw new Error('SUTRA_AUTO_PLAN_INVALID_JSON')
  }
  const parsed = videoPlanSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`SUTRA_AUTO_PLAN_INVALID_SCHEMA: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  }
  return parsed.data
}

// ---------------------------------------------------------------
// 1. PLANNING - Claude joue le role de directeur creatif
// ---------------------------------------------------------------

export async function planNextVideo(params: {
  config: AutoConfig
  themes: AutoTheme[]
  memories: AutoMemory[]
  recentVideos: AutoVideoRecord[]
  topVideos: AutoVideoRecord[]
  userId?: string
}): Promise<VideoPlan> {
  const { config, themes, memories, recentVideos, topVideos, userId } = params

  const memoryBlock = memories
    .slice(0, 30)
    .map((m) => `- [${m.memory_type}] ${m.content}`)
    .join('\n')

  const themesBlock = themes
    .filter((t) => t.is_active)
    .map(
      (t) =>
        `{ "id": "${t.id}", "theme": "${t.theme}", "tone": "${t.tone ?? ''}", ` +
        `"audience": "${t.target_audience ?? ''}", "weight": ${t.weight}, ` +
        `"must": ${JSON.stringify(t.must_include)}, "never": ${JSON.stringify(t.never_include)} }`
    )
    .join('\n')

  const recentBlock = recentVideos
    .slice(0, 10)
    .map((v) => `- "${v.title}" (theme=${v.theme_id ?? 'n/a'}, prompt=${(v.prompt_used ?? '').slice(0, 80)})`)
    .join('\n')

  const topBlock = topVideos
    .slice(0, 5)
    .map((v) => `- "${v.title}" (theme=${v.theme_id ?? 'n/a'})`)
    .join('\n')

  const trends = memories
    .filter((m) => m.memory_type === 'trend')
    .slice(0, 10)
    .map((m) => `- ${m.content}`)
    .join('\n')

  const insights = memories
    .filter((m) => m.memory_type === 'learning' || m.memory_type === 'performance')
    .slice(0, 10)
    .map((m) => `- ${m.content}`)
    .join('\n')

  const system = `Tu es le directeur creatif de SUTRA, le studio video IA le plus avance au monde.

MISSION
Creer du contenu video viral, unique, qui arrete le scroll en 0.5s.

MEMOIRE UTILISATEUR
${memoryBlock || '(vide)'}

PREFERENCES
- Style: ${config.default_style}
- Duree: ${config.default_duration}s
- Format: ${config.default_aspect_ratio}
- Musique: ${config.default_music_genre}
- Langue: ${config.default_language}
- Voix activee: ${config.default_voice_enabled}

THEMES DISPONIBLES
${themesBlock || '(aucun theme - libre creativite)'}

DERNIERES VIDEOS (eviter repetition)
${recentBlock || '(aucune)'}

TOP PERFORMANCES
${topBlock || '(aucune donnee)'}

TENDANCES ACTUELLES
${trends || '(aucune detectee)'}

INSIGHTS
${insights || '(aucun)'}

REGLES
1. JAMAIS deux videos identiques
2. Utilise les insights de performance
3. Surfe sur les tendances quand pertinent
4. video_prompt = ultra-detaille en ANGLAIS, cinematique
5. Titre irresistible (max 60 chars)
6. 10-15 hashtags pour decouvrabilite
7. Respecte must_include / never_include du theme
8. Privilegie les themes avec poids eleves et peu utilises recemment
9. N'invente aucun fait, chiffre, temoignage, marque, tendance ou fonctionnalite
10. N'ecris aucun texte ni logo dans video_prompt : ces elements sont ajoutes en postproduction
11. Decris sujet, action, decor, cadrage, lumiere, camera et progression temporelle
12. expected_engagement est une hypothese, jamais une garantie

FORMAT (JSON strict, aucun texte autour)
{
  "title": "...",
  "description": "...",
  "hashtags": ["#tag1","#tag2"],
  "video_prompt": "...",
  "music_prompt": "...",
  "script": null,
  "style_override": null,
  "theme_id": "uuid ou null",
  "reasoning": "...",
  "expected_engagement": "high",
  "trend_leveraged": null
}`

  const result = await smarana.ask({
    appSlug: 'sutra',
    userId,
    system,
    message: `Cree le plan de la prochaine video pour ce createur. Aujourd'hui: ${new Date().toISOString()}.`,
    tier: 'main',
    maxTokens: 2000,
  })

  return parseVideoPlan(result.text)
}

// ---------------------------------------------------------------
// 2. GENERATION - video + musique (+ voix optionnelle)
// ---------------------------------------------------------------

export async function generateAutoVideoAssets(params: {
  videoId: string
  plan: VideoPlan
  config: AutoConfig
  userEmail: string | null
  plan_tier: Plan
  progress?: {
    steps: Record<string, unknown>
    onStepResolved?: (key: string, value: unknown) => Promise<void>
    heartbeat?: () => Promise<void>
  }
}): Promise<{
  video_raw_url: string
  audio_music_url: string | null
  audio_voice_url: string | null
}> {
  const { videoId, plan, config, userEmail, plan_tier } = params

  if (config.default_voice_enabled && (!plan.script || !config.default_voice_id)) {
    throw new Error('Voix demandee: script et identifiant vocal requis avant generation')
  }
  const done = params.progress?.steps ?? {}
  const hooks = params.progress ?? {}
  const step = pipelineSteps(done, hooks)
  const save = async (key: string, value: unknown) => {
    await params.progress?.onStepResolved?.(key, value)
    done[key] = value
  }
  const asset = async (key: string, generate: () => Promise<string>): Promise<string> => {
    if (typeof done[key] === 'string' && done[key]) return done[key] as string
    const remote = done[`${key}:ltx`] as LtxJobState | undefined
    if (done[`${key}:started`] && !(key === 'asset:video' && remote?.id)) throw new Error(`SUTRA_RECONCILIATION_REQUIRED: ${key}`)
    await save(`${key}:started`, true)
    const value = await generate()
    if (!value) throw new Error(`Resultat obligatoire manquant: ${key}`)
    await save(key, value)
    return value
  }

  // 1. Video brute (LTX/WAN)
  const video_raw_url = await asset('asset:video', async () => {
    const ltxResult = await generateVideoSmart(plan.video_prompt, plan_tier, userEmail, {
      format: config.default_aspect_ratio,
      quality: config.quality_level,
      duration: config.default_duration,
      userId: config.user_id,
      videoId,
      job: durableLtxJob(done, 'asset:video:ltx', params.progress?.onStepResolved),
    })
    return uploadToStorage(`auto/${videoId}/raw.mp4`, ltxResult.videoBuffer, 'video/mp4')
  })

  // Chaque piste demandée doit être obtenue et checkpointée séparément.
  let audio_music_url: string | null = null
  if (config.default_music_genre && config.default_music_genre !== 'none') {
    audio_music_url = await musicCheckpointed(done, hooks, step, 'asset:music', async job => {
      const music = await generateMusic({
        prompt: plan.music_prompt,
        style: config.default_music_genre as never,
        duration: config.default_duration,
        instrumental: true,
      }, job)
      if (!music.audio_url?.trim()) throw new Error('SUTRA_REQUIRED_MUSIC_MISSING')
      return music.audio_url
    })
  }

  // 3. Voix (ElevenLabs) si activee + script present
  let audio_voice_url: string | null = null
  if (config.default_voice_enabled && plan.script && config.default_voice_id) {
    // Older jobs stored only an intent, with no recoverable bytes. Keep them
    // quarantined; a new worker cannot infer whether synthesis was charged.
    if (!done['asset:voice'] && done['asset:voice:started'] && !done.voice_submission_started) {
      throw new Error('SUTRA_RECONCILIATION_REQUIRED: asset:voice')
    }
    audio_voice_url = await step('asset:voice', async () => {
      // Reuse the production manifest/chunks and paid intent. Storage can retry
      // from the durable bytes without another ElevenLabs synthesis.
      const b64 = await voiceB64Checkpointed(done, hooks, step, {
        voice: (text) => generateVoice({ text, voice_id: config.default_voice_id! }),
      }, plan.script!, config.default_voice_id)
      if (!b64) throw new Error('SUTRA_VOICE_EMPTY_RESULT')
      return uploadToStorage(
        `auto/${videoId}/voice.mp3`,
        Buffer.from(b64, 'base64'),
        'audio/mpeg'
      )
    })
  }

  return { video_raw_url, audio_music_url, audio_voice_url }
}

export { publishAutoVideo, publishAutoVideoRecord } from './auto-publication'
