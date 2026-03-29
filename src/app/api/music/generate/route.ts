import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { generateMusic } from '@/lib/suno'
import { logApiCall } from '@/lib/logger'
import type { MusicStyle } from '@/types'

const musicSchema = z.object({
  prompt: z.string().min(3, 'Prompt requis').max(500),
  style: z.enum(['cinematic', 'lo-fi', 'epic', 'chill', 'motivational', 'dramatic', 'upbeat', 'ambient']),
  duration: z.number().min(10).max(300).default(60),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = musicSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { prompt, style, duration } = parsed.data

    const start = Date.now()
    const result = await generateMusic({
      prompt,
      style: style as MusicStyle,
      duration,
      instrumental: true,
    })
    await logApiCall(user.id, 'suno', 'generateMusic', 'success', Date.now() - start)

    return NextResponse.json({ id: result.id, audio_url: result.audio_url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur generation musique', details: message }, { status: 500 })
  }
}
