import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { checkLimits } from '@/lib/limits'
import { assembleFinalVideo, actualQualityFor, type AssembleClip } from '@/lib/shotstack'
import { sendNotification, logActivity } from '@/lib/logger'
import type { Profile } from '@/types'

export const maxDuration = 300

/**
 * POST /api/video/export — ré-exporte une vidéo existante avec les réglages
 * de l'éditeur (scènes, sous-titres, volumes). Endpoint référencé par
 * useEditorHandlers et désormais implémenté (audit #13 : un bouton Export
 * ne doit plus pointer vers une route absente).
 */
const exportSchema = z.object({
  videoId: z.string().min(1),
  quality: z.enum(['720p', '1080p', '4k']).default('1080p'),
  script: z.string().max(60_000).optional(),
  scenes: z
    .array(
      z.object({
        url: z.string().url(),
        duration: z.number().min(1).max(120).optional(),
        type: z.enum(['ia', 'stock']).optional(),
        kind: z.enum(['video', 'photo']).optional(),
      })
    )
    .max(60)
    .optional(),
  subtitles: z
    .array(
      z.object({
        text: z.string().max(500),
        start: z.number().min(0),
        end: z.number().min(0),
      })
    )
    .max(600)
    .optional(),
  voiceVolume: z.number().min(0).max(2).optional(),
  musicVolume: z.number().min(0).max(2).optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const parsed = exportSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 }
      )
    }
    const { videoId, quality, scenes, subtitles, musicVolume } = parsed.data

    const service = createServiceClient()
    const { data: video } = await service
      .from('videos')
      .select('id, user_id, voice_url, music_url, format, status')
      .eq('id', videoId)
      .single()

    // Permission : uniquement le propriétaire (audit #13 — permissions d'accès).
    if (!video || video.user_id !== user.id) {
      return NextResponse.json({ error: 'Video introuvable ou non autorisee' }, { status: 404 })
    }
    if (!video.voice_url) {
      return NextResponse.json({ error: 'Cette video n\'a pas de piste voix a exporter' }, { status: 400 })
    }

    // Un export re-rend chez Shotstack = un coût : il passe la garde de quota.
    const { data: profile } = await service.from('profiles').select('*').eq('id', user.id).single()
    if (profile) {
      const within = await checkLimits(profile as Profile)
      if (!within) {
        return NextResponse.json({ error: 'Limite de videos atteinte pour votre plan.' }, { status: 403 })
      }
    }

    const clips: AssembleClip[] = (scenes && scenes.length > 0 ? scenes : []).map((s) => ({
      url: s.url,
      type: s.type ?? 'ia',
      kind: s.kind,
      duration: s.duration,
    }))
    if (clips.length === 0) {
      return NextResponse.json({ error: 'Aucune scene a exporter' }, { status: 400 })
    }

    const assembled = await assembleFinalVideo({
      clips,
      voiceUrl: video.voice_url,
      musicUrl: video.music_url ?? '',
      musicVolume: musicVolume ?? 0.3,
      subtitles: subtitles ?? [],
      transitions: 'fade',
      format: video.format ?? '16:9',
      quality,
      brandKit: null,
    })

    const actualQuality = actualQualityFor(quality, assembled.outputQuality)
    await service
      .from('videos')
      .update({
        video_url: assembled.url,
        quality: actualQuality,
        duration: assembled.duration,
        status: 'ready',
      })
      .eq('id', videoId)

    await sendNotification(user.id, {
      type: 'success',
      title: 'Export termine !',
      message: 'Ton export est pret dans ta bibliotheque.',
    })
    await logActivity(user.id, 'video_exported', 'Video re-exportee depuis l\'editeur', { video_id: videoId, quality: actualQuality })

    return NextResponse.json({ success: true, url: assembled.url, quality: actualQuality })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur lors de l\'export', details: message }, { status: 500 })
  }
}
