import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

const DEFAULT_VOICES = [
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (FR)', language: 'fr', gender: 'female', is_cloned: false },
  { voice_id: '29vD33N1CtxCmqQRPOHJ', name: 'Thomas (FR)', language: 'fr', gender: 'male', is_cloned: false },
  { voice_id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlotte (FR)', language: 'fr', gender: 'female', is_cloned: false },
  { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Nathan (FR)', language: 'fr', gender: 'male', is_cloned: false },
  { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (EN)', language: 'en', gender: 'male', is_cloned: false },
  { voice_id: 'XB0fDUnXU5powFXDhCwa', name: 'Emily (EN)', language: 'en', gender: 'female', is_cloned: false },
]

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const { data: clonedVoices } = await serviceClient
      .from('cloned_voices')
      .select('id, name, elevenlabs_voice_id, preview_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const userVoices = (clonedVoices ?? []).map((v) => ({
      voice_id: v.elevenlabs_voice_id,
      name: v.name,
      language: 'custom',
      gender: 'custom' as const,
      is_cloned: true,
      preview_url: v.preview_url,
    }))

    return NextResponse.json({
      voices: [...userVoices, ...DEFAULT_VOICES],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation voix', details: message }, { status: 500 })
  }
}
