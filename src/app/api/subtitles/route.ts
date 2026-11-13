import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  autoGenerateSubtitles,
  translateSubtitles,
  generateSRT,
} from '@/lib/subtitles'
import type { SubtitleStyle } from '@/lib/subtitles'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
    }

    const { narration, duration, style, targetLang } = body as {
      narration?: string
      duration?: number
      style?: SubtitleStyle
      targetLang?: string
    }

    if (!narration || typeof narration !== 'string' || narration.trim().length === 0) {
      return NextResponse.json({ error: 'Narration requise' }, { status: 400 })
    }

    // Les générateurs arrondissent les temps en millisecondes entières.
    if (typeof duration !== 'number' || duration <= 0 || !Number.isSafeInteger(Math.round(duration * 1000))) {
      return NextResponse.json({ error: 'Duree invalide' }, { status: 400 })
    }

    const subtitleStyle: SubtitleStyle = style ?? 'classic'
    let subtitles = autoGenerateSubtitles(narration, duration, subtitleStyle)

    if (targetLang && typeof targetLang === 'string') {
      subtitles = await translateSubtitles(subtitles, targetLang)
    }

    const srt = generateSRT(subtitles)

    return NextResponse.json({ subtitles, srt })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la generation des sous-titres'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
