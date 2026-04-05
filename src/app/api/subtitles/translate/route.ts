import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { translateSubtitles, generateSRT } from '@/lib/subtitles'
import type { SubtitleEntry } from '@/types'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const { subtitles, targetLang } = body as {
      subtitles?: SubtitleEntry[]
      targetLang?: string
    }

    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
      return NextResponse.json({ error: 'Sous-titres requis' }, { status: 400 })
    }

    if (!targetLang || typeof targetLang !== 'string' || targetLang.trim().length === 0) {
      return NextResponse.json({ error: 'Langue cible requise' }, { status: 400 })
    }

    const translated = await translateSubtitles(subtitles, targetLang)
    const srt = generateSRT(translated)

    return NextResponse.json({ subtitles: translated, srt })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la traduction des sous-titres'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
