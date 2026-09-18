import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { checkLimits } from '@/lib/limits'
import { generateScript } from '@/lib/claude'
import { generateVisualWithFallback, generateMusicWithFallback, generateVoiceWithFallback, type VisualResult } from '@/lib/fallbacks'
import { searchVideos, type MediaFormat } from '@/lib/pexels'
import { clampQualityToPlan } from '@/lib/ltx-utils'
import { resolveVoiceProviderId } from '@/lib/constants'
import { uploadToStorage } from '@/lib/storage'
import { assembleFinalVideo, generateSubtitlesFromScript, actualQualityFor, type AssembleClip } from '@/lib/shotstack'
import { logApiCall, logActivity, sendNotification } from '@/lib/logger'
import type { Plan, Profile, ScriptData } from '@/types'

// Aligné sur les fournisseurs les plus lents (Shotstack/WAN 300s) — audit #14.
export const maxDuration = 300

// Validation stricte des entrées — formats limités aux 3 ratios réellement
// supportés par la chaîne, étapes connues uniquement.
const productionSchema = z.object({
  step: z.enum(['script', 'video', 'voice', 'music', 'assembly', 'thumbnail', 'all']),
  idea: z.string().min(1, 'idee requise').max(500),
  template: z.string().optional(),
  format: z.enum(['16:9', '9:16', '1:1']).optional(),
  engine: z.enum(['ltx-pro', 'ltx-fast', 'wan-classic']).optional(),
  voice: z.string().max(120).optional(),
  musicStyle: z.string().max(120).optional(),
  tone: z.string().max(120).optional(),
  previousData: z.unknown().optional(),
})

// Bornes anti-dépense sur les données renvoyées par le client (audit #8) :
// un previousData non borné ne doit jamais déclencher un Promise.all massif.
const MAX_SCENES = 60
const MAX_NARRATION_CHARS = 60_000

const TEMPLATE_CONFIGS: Record<string, { durationHint: string; sceneCount: number }> = {
  youtube: { durationHint: '8-12 minutes', sceneCount: 12 },
  tiktok: { durationHint: '30-60 secondes', sceneCount: 4 },
  reel: { durationHint: '15-30 secondes', sceneCount: 3 },
  docu: { durationHint: '10-20 minutes', sceneCount: 15 },
  tuto: { durationHint: '3-8 minutes', sceneCount: 8 },
}

function sanitizeScriptData(raw: unknown): ScriptData | undefined {
  const s = raw as ScriptData | undefined
  if (!s || !Array.isArray(s.scenes)) return undefined
  return {
    ...s,
    narration: (s.narration ?? '').slice(0, MAX_NARRATION_CHARS),
    scenes: s.scenes.slice(0, MAX_SCENES),
  }
}

/** Toute étape qui déclenche un coût fournisseur passe la garde de quota. */
async function guardQuota(profile: Record<string, unknown>): Promise<Response | null> {
  const within = await checkLimits(profile as unknown as Profile)
  if (!within) {
    return NextResponse.json({ error: 'Limite de videos atteinte pour votre plan.' }, { status: 403 })
  }
  return null
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = productionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 }
      )
    }
    const { step, idea, template, format, engine, voice, musicStyle, tone } = parsed.data
    const previousData = (parsed.data.previousData ?? {}) as Record<string, unknown>

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    const userPlan = (profile as Profile).plan ?? 'free'
    // Plafond qualité par plan appliqué AVANT tout appel payant (audit #16).
    const qualityCap = clampQualityToPlan(profile.preferred_quality ?? '1080p', userPlan, user.email)
    const mediaFormat = (['9:16', '16:9', '1:1'].includes(format ?? '') ? format : '16:9') as MediaFormat
    const genPlan: Plan = engine === 'wan-classic' ? 'free' : userPlan

    // Step-by-step production
    if (step === 'script') {
      const config = TEMPLATE_CONFIGS[template ?? ''] ?? TEMPLATE_CONFIGS.youtube
      const script = await generateScript({
        topic: idea,
        niche: 'general',
        style: tone ?? 'professionnel',
        format: format ?? '16:9',
        duration: config.durationHint,
      })
      await logApiCall(user.id, 'claude', 'production-script', 'success')
      return NextResponse.json({ data: script })
    }

    if (step === 'video') {
      const denied = await guardQuota(profile)
      if (denied) return denied

      const scriptData = sanitizeScriptData(previousData?.script)
      if (!scriptData?.scenes?.length) {
        return NextResponse.json({ error: 'Script requis pour generer les scenes' }, { status: 400 })
      }

      // TOUTES les scènes sont résolues dans l'ordre (audit #5) : une scène
      // use_stock part en recherche stock, pas en filtre qui la supprime.
      const sceneUrls = await Promise.all(
        scriptData.scenes.slice(0, MAX_SCENES).map(async (scene): Promise<VisualResult | null> => {
          const duration = Math.max(1, scene.duration_seconds || 5)
          if (scene.use_stock) {
            const stock = await searchVideos(scene.visual_prompt, 1, { format: mediaFormat })
            const best = stock[0]
            if (!best) return null
            return {
              url: best.url,
              engine: 'wan-classic',
              source: 'pexels-stock',
              stockMeta: { id: best.id, author: best.author, authorUrl: best.authorUrl, sourcePage: best.sourcePage, width: best.width, height: best.height },
            }
          }
          return generateVisualWithFallback(scene.visual_prompt, qualityCap, user.email, genPlan, mediaFormat, false, { userId: user.id, duration })
        })
      )
      const resolved = sceneUrls.filter(Boolean) as VisualResult[]
      await logApiCall(user.id, 'ltx', 'production-video', 'success')
      return NextResponse.json({ data: resolved })
    }

    if (step === 'voice') {
      const denied = await guardQuota(profile)
      if (denied) return denied

      const scriptData = sanitizeScriptData(previousData?.script)
      if (!scriptData?.narration) {
        return NextResponse.json({ error: 'Script requis pour la narration' }, { status: 400 })
      }

      // Alias voix résolu vers un ID ElevenLabs réel (audit #18).
      const voiceId = resolveVoiceProviderId(voice)
      const voiceBuffer = await generateVoiceWithFallback(scriptData.narration, voiceId)
      const voicePath = `production/${user.id}/${Date.now()}.mp3`
      const voiceUrl = await uploadToStorage(voicePath, voiceBuffer, 'audio/mpeg')
      await logApiCall(user.id, 'elevenlabs', 'production-voice', 'success')
      return NextResponse.json({ data: { url: voiceUrl } })
    }

    if (step === 'music') {
      const denied = await guardQuota(profile)
      if (denied) return denied

      const url = await generateMusicWithFallback(
        `${musicStyle ?? 'cinematic'} background music for ${idea}`,
        musicStyle ?? 'cinematic',
        120
      )
      await logApiCall(user.id, 'suno', 'production-music', url ? 'success' : 'skipped')
      return NextResponse.json({ data: { url: url || null } })
    }

    if (step === 'assembly') {
      const denied = await guardQuota(profile)
      if (denied) return denied

      const scriptData = sanitizeScriptData(previousData?.script)
      const videoData = previousData?.video as Array<Partial<AssembleClip>> | undefined
      const voiceData = previousData?.voice as { url: string } | undefined
      const musicData = previousData?.music as { url: string } | undefined

      if (!videoData?.length || !voiceData?.url) {
        return NextResponse.json({ error: 'Video et voix requises pour l\'assemblage' }, { status: 400 })
      }

      const clips: AssembleClip[] = videoData.slice(0, MAX_SCENES).map((v) => ({
        url: v.url!,
        type: v.type === 'stock' ? 'stock' : 'ia',
        kind: v.kind,
        duration: v.duration,
      }))
      const subtitles = scriptData?.narration
        ? generateSubtitlesFromScript(scriptData.narration, scriptData.scenes ?? [])
        : []

      const assembled = await assembleFinalVideo({
        clips,
        voiceUrl: voiceData.url,
        musicUrl: musicData?.url ?? '',
        musicVolume: 0.3,
        subtitles,
        transitions: 'fade',
        format: format ?? '16:9',
        quality: qualityCap,
        brandKit: (profile as Profile).brand_kit ?? null,
      })

      // Save to videos table — qualité RÉELLE : le stage Shotstack plafonne à
      // HD, une demande 4k rendue en HD n'est jamais annoncée 4k.
      const actualQuality = actualQualityFor(qualityCap, assembled.outputQuality)
      const { data: videoRow } = await serviceClient
        .from('videos')
        .insert({
          user_id: user.id,
          title: scriptData?.title ?? 'Production',
          description: scriptData?.description ?? '',
          video_url: assembled.url,
          duration: assembled.duration,
          format: format ?? '16:9',
          quality: actualQuality,
          status: 'ready',
          tags: scriptData?.tags ?? [],
          script_data: scriptData ?? null,
        })
        .select('id')
        .single()

      await logApiCall(user.id, 'shotstack', 'production-assembly', 'success')
      await sendNotification(user.id, {
        type: 'success',
        title: 'Production terminee',
        message: `Ta video "${scriptData?.title ?? 'Production'}" est prete !`,
      })

      return NextResponse.json({ data: { url: assembled.url, videoId: videoRow?.id } })
    }

    if (step === 'thumbnail') {
      const scriptData = sanitizeScriptData(previousData?.script)
      const thumbnailPrompt = scriptData?.thumbnail_prompt ?? `cinematic thumbnail for ${idea}`
      const thumbnailUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(thumbnailPrompt)}?width=1920&height=1080&model=flux&enhance=true&nologo=true`
      return NextResponse.json({ data: { url: thumbnailUrl } })
    }

    // Generate ALL at once
    if (step === 'all') {
      const denied = await guardQuota(profile)
      if (denied) return denied

      const config = TEMPLATE_CONFIGS[template ?? ''] ?? TEMPLATE_CONFIGS.youtube

      // 1. Script
      const script = await generateScript({
        topic: idea,
        niche: 'general',
        style: tone ?? 'professionnel',
        format: format ?? '16:9',
        duration: config.durationHint,
      })

      const voiceId = resolveVoiceProviderId(voice)
      const requestedQuality = qualityCap

      // 2. Parallel: voice, music, scenes — TOUTES les scènes dans l'ordre,
      // stock résolu en stock (audit #5), durée portée par clip (audit #4).
      const [voiceBuffer, musicUrl, sceneResults] = await Promise.all([
        generateVoiceWithFallback(script.narration, voiceId),
        generateMusicWithFallback(
          `${musicStyle ?? 'cinematic'} background music for ${idea}`,
          musicStyle ?? 'cinematic',
          script.estimated_duration
        ),
        Promise.all(
          script.scenes.slice(0, MAX_SCENES).map(async (scene): Promise<AssembleClip | null> => {
            const duration = Math.max(1, scene.duration_seconds || 5)
            if (scene.use_stock) {
              const stock = await searchVideos(scene.visual_prompt, 1, { format: mediaFormat })
              const best = stock[0]
              if (!best) return null
              return { url: best.url, type: 'stock', kind: 'video', duration: Math.max(duration, Math.min(best.duration || duration, 60)) }
            }
            const visual = await generateVisualWithFallback(scene.visual_prompt, requestedQuality, user.email, genPlan, mediaFormat, false, { userId: user.id, duration })
            return {
              url: visual.url,
              type: visual.source === 'pexels-stock' ? 'stock' : 'ia',
              kind: 'video',
              duration,
            }
          })
        ),
      ])

      // Upload voice
      const voicePath = `production/${user.id}/${Date.now()}.mp3`
      const voiceUrl = await uploadToStorage(voicePath, voiceBuffer, 'audio/mpeg')

      // 3. Assembly — un clip stock (fallback Pexels) garde son type 'stock'
      const clips = sceneResults.filter(Boolean) as AssembleClip[]
      if (clips.length === 0) {
        throw new Error('Aucune scene resolue (IA et stock indisponibles) — video annulee, aucun autre cout engage')
      }
      const subtitles = generateSubtitlesFromScript(script.narration, script.scenes)

      const assembled = await assembleFinalVideo({
        clips,
        voiceUrl,
        musicUrl: musicUrl || '',
        musicVolume: 0.3,
        subtitles,
        transitions: 'fade',
        format: format ?? '16:9',
        quality: requestedQuality,
        brandKit: (profile as Profile).brand_kit ?? null,
      })

      // 4. Thumbnail (image, jamais un MP4 dans une balise <img> — audit #18)
      const thumbnailUrl = clips.find((c) => c.kind === 'photo')?.url
        ?? `https://image.pollinations.ai/prompt/${encodeURIComponent(script.thumbnail_prompt)}?width=1920&height=1080&model=flux&enhance=true&nologo=true`

      // Save — qualité réelle après plafonnement HD Shotstack
      const actualQuality = actualQualityFor(requestedQuality, assembled.outputQuality)
      await serviceClient.from('videos').insert({
        user_id: user.id,
        title: script.title,
        description: script.description,
        video_url: assembled.url,
        thumbnail_url: thumbnailUrl,
        duration: assembled.duration,
        format: format ?? '16:9',
        quality: actualQuality,
        status: 'ready',
        tags: script.tags,
        script_data: script,
      })

      await logActivity(user.id, 'production_completed', `Production "${script.title}" terminee`)

      return NextResponse.json({
        data: {
          script,
          video: clips,
          voice: { url: voiceUrl },
          music: { url: musicUrl || null },
          assembly: { url: assembled.url },
          thumbnail: { url: thumbnailUrl },
        },
      })
    }

    return NextResponse.json({ error: 'Etape inconnue' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
