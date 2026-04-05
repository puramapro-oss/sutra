import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { generateSRT } from '@/lib/subtitles'
import type { SubtitleEntry } from '@/types'

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const { subtitles } = body as { subtitles?: SubtitleEntry[] }

    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
      return NextResponse.json({ error: 'Sous-titres requis' }, { status: 400 })
    }

    const srt = generateSRT(subtitles)

    return new Response(srt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="subtitles.srt"',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur lors de l\'export des sous-titres'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
