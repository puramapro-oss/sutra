import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { generateVoice } from '@/lib/elevenlabs'
import { uploadToStorage } from '@/lib/storage'
import { logApiCall } from '@/lib/logger'

const voiceGenerateSchema = z.object({
  text: z.string().min(1, 'Texte requis').max(5000),
  voice_id: z.string().min(1, 'voice_id requis'),
  model_id: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = voiceGenerateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { text, voice_id, model_id } = parsed.data

    const start = Date.now()
    const audioBuffer = await generateVoice({ text, voice_id, model_id })
    await logApiCall(user.id, 'elevenlabs', 'generateVoice', 'success', Date.now() - start)

    const path = `voices/${user.id}/${Date.now()}.mp3`
    const url = await uploadToStorage(path, audioBuffer, 'audio/mpeg')

    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur generation voix', details: message }, { status: 500 })
  }
}
